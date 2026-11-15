package dev.zavz.compat1710.feature;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Small deterministic registry for features owned by this Forge mod.
 */
public final class FeatureRegistry {
    private final Map<String, Feature> features = new LinkedHashMap<String, Feature>();

    public void register(Feature feature) {
        if (feature == null) {
            throw new IllegalArgumentException("feature must not be null");
        }
        String id = feature.getId();
        if (id == null || id.trim().isEmpty()) {
            throw new IllegalArgumentException("feature id must not be blank");
        }
        String key = id.toLowerCase(java.util.Locale.ROOT);
        if (features.containsKey(key)) {
            throw new IllegalArgumentException("duplicate feature id: " + id);
        }
        features.put(key, feature);
    }

    public Feature get(String id) {
        if (id == null) {
            return null;
        }
        return features.get(id.toLowerCase(java.util.Locale.ROOT));
    }

    public List<Feature> getAll() {
        return Collections.unmodifiableList(
            new ArrayList<Feature>(features.values())
        );
    }

    public int size() {
        return features.size();
    }
}
