# Bundled files

- `native.dll`: the loader, kept in git because the ZAVZ executable embeds it. It reads the per-process selection in `.zywl\injector\plans\<pid>.ini` inside the user's home folder.
- `fdp-lunar.dll`: the current FDPClient Lunar startup loader, built from `FDPClient/native/lunar`. It is embedded separately and selected only for **FDPClient Inject**. Start the watcher before launching Lunar 1.8.9, without the FDP `-javaagent` argument.
- `fdpclient-inject.jar`: the self-contained FDPClient Inject bundle. Its path is selectable in the JAR window. Renamed JARs are recognized by their contents.
- `visuals.jar`: the Julia JAR, not in git. The installer ships it if the file is here at build time. Users can choose their Julia JAR from any folder.

ZAVZ stores injector state and its DLLs under `.zywl` in the current user's home folder. JARs stay at their selected locations; ZAVZ saves and uses those paths directly. Restart Minecraft to change a project that is already loaded.

To update these files, copy them from their builds:
```
Copy-Item <FDPClient>/build/native-lunar/Release/fdp-lunar.dll src/load/fdp-lunar.dll
Copy-Item <FDPClient>/build/libs/fdpclient-inject.jar src/load/fdpclient-inject.jar
Copy-Item <Julia>/build/libs/<julia-build>.jar src/load/visuals.jar
```
