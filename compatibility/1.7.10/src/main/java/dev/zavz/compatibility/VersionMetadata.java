package dev.zavz.compatibility;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonParser;

/** Passive parser for the top-level id field in a Minecraft version JSON file. */
public final class VersionMetadata {
    private VersionMetadata() {
    }

    /**
     * Reads only the top-level string property named "id".
     * Invalid JSON, missing properties, and non-string values return an empty string.
     */
    public static String readVersionId(String json) {
        if (json == null || json.trim().isEmpty()) {
            return "";
        }

        try {
            JsonElement root = JsonParser.parseString(json);
            if (!root.isJsonObject()) {
                return "";
            }

            JsonObject object = root.getAsJsonObject();
            JsonElement id = object.get("id");
            if (id == null || !id.isJsonPrimitive() || !id.getAsJsonPrimitive().isString()) {
                return "";
            }
            return id.getAsString().trim();
        } catch (JsonParseException | IllegalStateException exception) {
            return "";
        }
    }

    /** True only when the metadata declares exactly Minecraft 1.7.10. */
    public static boolean targetsMinecraft1710(String json) {
        return MinecraftTarget.isSupportedVersion(readVersionId(json));
    }
}
