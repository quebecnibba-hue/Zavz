package dev.zavz.compat1710.feature;

/**
 * Describes a passive client feature. Implementations must not automate
 * gameplay or modify other processes.
 */
public interface Feature {
    String getId();
    String getDescription();
}
