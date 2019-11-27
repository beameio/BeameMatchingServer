# BeameMatchingServer

[![Actions Status](/../../workflows/Build/badge.svg?branch=dev)](/../../actions?query=workflow%3A%22Build%22+branch%3Adev)

## Environment Variables
* `BEAME_ENV` sets the environment (that defines the default fqdn to use), if not defined prod is used
* `BEAME_MATCHING_SERVER_FQDN` overrides the matching server fqdn used
* `BEAME_DATA_FOLDER` sets the datafolder for the matching server, if not defined ".beame_matching_data" is used