#!/bin/sh
# Multi-region OTP supervisor.
# Each region gets its own subdirectory, its own graph.obj, and its own OTP
# process on a dedicated port. Build once, serve forever.
#
# Signal protocol (file-based via shared volume):
#   backend writes {DATA_DIR}/{key}/.port    — port to use
#   backend writes {DATA_DIR}/{key}/.rebuild — triggers build + serve
#   supervisor kills old OTP for that region (if any), builds if needed, serves
#
# Environment variables:
#   PRELOAD_REGIONS  comma-separated country codes to auto-load on startup
#                    e.g. "DE,TR,FR" — loads those graphs immediately.
#                    Leave empty (default) to load lazily on first request.
#                    Avoids OOM from launching 30+ Java processes at once.

DATA_DIR=/var/opentripplanner
OTP_JAR=/opt/otp/otp.jar
JAVA_BUILD_OPTS="${JAVA_BUILD_OPTS:--Xmx10g -Xms1g}"
JAVA_SERVE_OPTS="${JAVA_SERVE_OPTS:--Xmx3g -Xms256m}"

log() { printf '[supervisor %s] %s\n' "$(date '+%H:%M:%S')" "$*"; }

mkdir -p "$DATA_DIR"

# Clean up stale PID files left by a previous container run
for pid_f in "$DATA_DIR"/*/.pid; do
    [ -f "$pid_f" ] && rm -f "$pid_f"
done

# Auto-load regions listed in PRELOAD_REGIONS (e.g. "DE,TR,FR").
# Each region loads sequentially (not in parallel) to avoid RAM spikes.
# If PRELOAD_REGIONS is empty, nothing is loaded until the backend triggers a .rebuild.
if [ -n "$PRELOAD_REGIONS" ]; then
    log "PRELOAD_REGIONS=$PRELOAD_REGIONS — loading listed regions"
    # Convert comma-separated list to newline for iteration
    echo "$PRELOAD_REGIONS" | tr ',' '\n' | while read -r key; do
        key=$(echo "$key" | tr -d '[:space:]')
        [ -n "$key" ] || continue
        region_dir="$DATA_DIR/$key"
        [ -f "$region_dir/graph.obj" ] || { log "[$key] No graph.obj — skipping preload"; continue; }
        [ -f "$region_dir/.port"     ] || { log "[$key] No .port file — skipping preload"; continue; }
        port=$(cat "$region_dir/.port")
        log "[$key] Preloading graph on port $port …"
        java $JAVA_SERVE_OPTS -jar "$OTP_JAR" --load --port "$port" "$region_dir" &
        echo $! > "$region_dir/.pid"
        log "[$key] OTP started (PID $!)"
    done
else
    log "PRELOAD_REGIONS not set — lazy mode (regions load on first request)"
fi

log "Watching for rebuild signals in $DATA_DIR ..."
while true; do
    for rebuild_flag in "$DATA_DIR"/*/.rebuild; do
        [ -f "$rebuild_flag" ] || continue

        region_dir=$(dirname "$rebuild_flag")
        key=$(basename "$region_dir")
        pid_file="$region_dir/.pid"
        port_file="$region_dir/.port"
        graph_file="$region_dir/graph.obj"

        if [ ! -f "$port_file" ]; then
            log "[$key] No .port file found — skipping"
            continue
        fi
        port=$(cat "$port_file")
        log "[$key] Rebuild signal received (port $port)"
        rm -f "$rebuild_flag"

        # Stop the existing OTP instance for this region (if running)
        if [ -f "$pid_file" ]; then
            old_pid=$(cat "$pid_file")
            log "[$key] Stopping old OTP (PID $old_pid)"
            kill "$old_pid" 2>/dev/null || true
            wait "$old_pid" 2>/dev/null || true
            rm -f "$pid_file"
        fi

        # Seed config files if absent (runDownload overwrites build-config.json anyway)
        [ -f "$region_dir/build-config.json"  ] || cp /opt/otp/build-config.json  "$region_dir/"
        [ -f "$region_dir/router-config.json" ] || cp /opt/otp/router-config.json "$region_dir/"

        # Build from GTFS + OSM only if no pre-built graph exists (first time for region)
        if [ ! -f "$graph_file" ]; then
            log "[$key] Building graph for the first time (5-15 min) ..."
            java $JAVA_BUILD_OPTS -jar "$OTP_JAR" --build --save "$region_dir"
            build_exit=$?
            if [ $build_exit -ne 0 ] || [ ! -f "$graph_file" ]; then
                log "[$key] Build FAILED (exit $build_exit)"
                printf 'build-failed\n' > "$region_dir/.error"
                continue
            fi
            rm -f "$region_dir/.error"
            log "[$key] Build complete"
        else
            log "[$key] Pre-built graph found — loading directly (< 1 min)"
        fi

        # Start OTP server for this region on its assigned port
        log "[$key] Starting OTP on port $port"
        java $JAVA_SERVE_OPTS -jar "$OTP_JAR" --load --port "$port" "$region_dir" &
        echo $! > "$pid_file"
        log "[$key] OTP started (PID $!, port $port)"
    done
    sleep 5
done
