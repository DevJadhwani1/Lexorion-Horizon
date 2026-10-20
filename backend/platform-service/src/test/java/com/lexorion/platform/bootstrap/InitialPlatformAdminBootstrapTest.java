package com.lexorion.platform.bootstrap;

import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.core.platformaccess.service.PlatformAccessService;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.core.user.service.UserService;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class InitialPlatformAdminBootstrapTest {
    @Test void disabledBootstrapDoesNotTouchIdentityStore() {
        var users = mock(UserRepository.class);
        var access = mock(PlatformAccessRepository.class);
        var service = mock(UserService.class);
        var grants = mock(PlatformAccessService.class);
        new InitialPlatformAdminBootstrap(new BootstrapProperties(), access, service, users, grants, null).run(null);
        verifyNoInteractions(users, access, service, grants);
    }
    @Test void enabledBootstrapCannotPromoteExistingUsersOrRecreateRevokedAdmin() {
        var properties = new BootstrapProperties(); properties.setEnabled(true);
        var users = mock(UserRepository.class); when(users.count()).thenReturn(1L);
        var service = mock(UserService.class); var grants = mock(PlatformAccessService.class);
        var bootstrap = new InitialPlatformAdminBootstrap(properties, mock(PlatformAccessRepository.class), service, users, grants, null);
        assertThatThrownBy(() -> bootstrap.run(null)).isInstanceOf(IllegalStateException.class).hasMessageContaining("empty identity store");
        verifyNoInteractions(service, grants);
    }
    @Test void emptyDatabaseStillRequiresExplicitValidCredentials() {
        var properties = new BootstrapProperties(); properties.setEnabled(true);
        var service = mock(UserService.class); var grants = mock(PlatformAccessService.class);
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var bootstrap = new InitialPlatformAdminBootstrap(properties, mock(PlatformAccessRepository.class), service, mock(UserRepository.class), grants, factory.getValidator());
            assertThatThrownBy(() -> bootstrap.run(null)).isInstanceOf(IllegalStateException.class).hasMessageContaining("configuration is invalid");
        }
        verifyNoInteractions(service, grants);
    }
}
