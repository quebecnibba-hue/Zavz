package dev.zavz.compatibility;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Passive parser for the top-level id field in a Minecraft version JSON file. */
public final class VersionMetadata {
    private static final Pattern ID_FIELD = Pattern.compile(
        "\\\"id\\\"\\s*:\\s*\\\"([^\\"]+)\\\""
    );

    private VersionMetadata() {
    }

    /** Extracts the version id from launcher metadata text. */
    public static String readVersionId(String json) {
        if (json == null || json.trim().isEmpty()) {
            return "";
        }
        Matcher matcher = ID_FIELD.matcher(json);
        return matcher.find() ? matcher.group(1).trim() : "";
    }

    /** True only when the metadata declares exactly Minecraft 1.7.10. */
    public static boolean targetsMinecraft1710(String json) {
        return MinecraftTarget.isSupportedVersion(readVersionId(json));
    }
}
