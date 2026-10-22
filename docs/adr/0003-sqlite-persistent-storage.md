# SQLite is the persistent store

The app will use one SQLite database in Home Assistant's persistent app storage and include it in Home Assistant backups. The workload is a self-hosted household finance app with no existing data to migrate, and SQLite keeps deployment and runtime dependencies small compared with a separate database service. The data model can be redesigned without preserving the Python API's schema or client compatibility.
