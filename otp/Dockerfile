FROM eclipse-temurin:21-jdk-jammy

RUN apt-get update && apt-get install -y wget curl python3 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/otp

# Download OTP 2.5.0
ARG OTP_VERSION=2.5.0
RUN wget -q \
    "https://github.com/opentripplanner/OpenTripPlanner/releases/download/v${OTP_VERSION}/otp-${OTP_VERSION}-shaded.jar" \
    -O otp.jar

# Copy config files
COPY build-config.json router-config.json ./

# /var/opentripplanner is where GTFS + OSM files are volume-mounted
VOLUME ["/var/opentripplanner", "/graphs"]

EXPOSE 8080

# Entrypoint: build graph if needed, then serve
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
