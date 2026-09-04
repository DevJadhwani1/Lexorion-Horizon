package com.lexorion.payroll.tenant;

import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class AuthorityRequestContext {
    private final ThreadLocal<Credentials> current = new ThreadLocal<>();

    public void set(Credentials credentials) { current.set(credentials); }
    public Optional<Credentials> get() { return Optional.ofNullable(current.get()); }
    public void clear() { current.remove(); }

    public record Credentials(String bearerToken, String host, String organizationSlug) { }
}
