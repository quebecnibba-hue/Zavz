package dev.zavz.compatibility;

/**
 * Version metadata and safe checks for the Minecraft 1.7.10 target.
 * This class deliberately does not load code into or modify a game process.
 */
public final class MinecraftTarget {
    public static final String MINECRAFT_VERSION = "1.7.10";
    public static final String FORGE_VERSION = "10.13.4.1614";
    public static final int JAVA_LANGUAGE_LEVEL = 8;

    private MinecraftTarget() {
    }

    /** Returns true only for an exact Minecraft version match. */
    public static boolean isSupportedVersion(String detectedVersion) {
        return MINECRAFT_VERSION.equals(normalize(detectedVersion));
    }

    private static String normalize(String version) {
        return version == null ? "" : version.trim();
    }
}
