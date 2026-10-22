# MCP uses authenticated Streamable HTTP

The MCP server will use Streamable HTTP so local-network MCP clients can connect to the Home Assistant app, with explicit read/write tools authenticated by the same personal tokens as REST. The endpoint is intended for the local network and is not exposed to the Internet by default; Ingress authentication does not replace API/MCP authentication. This provides the requested remote-client capability without adding a separate MCP credential model.
