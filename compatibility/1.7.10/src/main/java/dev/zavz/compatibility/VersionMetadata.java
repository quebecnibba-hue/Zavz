package dev.zavz.compatibility;

/** Passive parser for the top-level id field in a Minecraft version JSON file. */
public final class VersionMetadata {
    private static final String ID_KEY = "\"id\"";

    private VersionMetadata() {
    }

    /** Extracts the first id value from launcher metadata text. */
    public static String readVersionId(String json) {
        if (json == null || json.trim().isEmpty()) {
            return "";
        }
        int keyIndex = json.indexOf(ID_KEY);
        if (keyIndex < 0) {
            return "";
        }
        int colonIndex = json.indexOf(':', keyIndex + ID_KEY.length());
        if (colonIndex < 0) {
            return "";
        }
        int openingQuote = json.indexOf('\"', colonIndex + 1);
        if (openingQuote < 0) {
            return "";
        }
        int closingQuote = json.indexOf('\"', openingQuote + 1);
        if (closingQuote < 0) {
            return "";
        }
        return json.substring(openingQuote + 1, closingQuote).trim();
    }

    /** True only when the metadata declares exactly Minecraft 1.7.10. */
    public static boolean targetsMinecraft1710(String json) {
        return MinecraftTarget.isSupportedVersion(readVersionId(json));
    }
}
