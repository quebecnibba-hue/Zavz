package dev.zavz.compatibility;

/** Result of passive Minecraft version identification from launcher metadata. */
public enum VersionCompatibility {
    /** No trustworthy top-level version id was available. */
    UNKNOWN,
    /** The metadata identifies the configured Minecraft target. */
    SUPPORTED,
    /** A valid version id was found, but it is not the configured target. */
    UNSUPPORTED
}
