package com.lexorion.core.product;

import jakarta.persistence.*;

@Entity
@Table(name = "core_products")
public class CoreProduct {
    @Id @Column(name = "product_key", length = 63) private String key;
    @Column(nullable = false, unique = true, updatable = false) private java.util.UUID id = java.util.UUID.randomUUID();
    @Column(nullable = false, length = 150) private String displayName;
    @Column(nullable = false) private boolean active;
    protected CoreProduct() {}
    public CoreProduct(String key, String displayName, boolean active) {
        this.key = key; this.displayName = displayName; this.active = active;
    }
    public java.util.UUID getId() { return id; }
    public void configure(String displayName, boolean active) { this.displayName = displayName; this.active = active; }
    public String getKey() { return key; }
    public String getDisplayName() { return displayName; }
    public boolean isActive() { return active; }
}
