package com.lexorion.horizon.invitation.delivery;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SmtpInvitationDeliveryTest {

    @Test
    void deliversInvitationWithLocalhostHttpOrigin() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mailSender);

        SmtpInvitationDelivery delivery = new SmtpInvitationDelivery(
                provider,
                "horizon@local.test",
                "http://localhost"
        );

        Instant expiresAt = Instant.parse("2026-10-27T12:00:00Z");
        delivery.deliver(new InvitationDelivery.InvitationMessage(
                "invited@example.test",
                "Acme Corp",
                "acme-corp",
                "secret-raw-token",
                expiresAt
        ));

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());

        SimpleMailMessage sent = captor.getValue();
        assertThat(sent.getFrom()).isEqualTo("horizon@local.test");
        assertThat(sent.getTo()).containsExactly("invited@example.test");
        assertThat(sent.getSubject()).isEqualTo("Invitation to Acme Corp");
        assertThat(sent.getText())
                .contains("You have been invited to Acme Corp (acme-corp).")
                .contains("Open http://localhost/invitations/accept#token=secret-raw-token")
                .contains("This invitation expires at 2026-10-27T12:00:00Z.")
                .contains("If you did not expect this invitation, ignore it.");
    }

    @Test
    void deliversInvitationWithHttpsOriginAndTrailingSlashTrimmed() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mailSender);

        SmtpInvitationDelivery delivery = new SmtpInvitationDelivery(
                provider,
                "noreply@horizon.lexorion.in",
                "https://horizon.lexorion.in/"
        );

        delivery.deliver(new InvitationDelivery.InvitationMessage(
                "invited@example.test",
                "Prod Org",
                "prod-org",
                "prod-token-123",
                Instant.parse("2026-10-27T12:00:00Z")
        ));

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());

        SimpleMailMessage sent = captor.getValue();
        assertThat(sent.getText()).contains("Open https://horizon.lexorion.in/invitations/accept#token=prod-token-123");
    }

    @Test
    void rejectsHttpOriginWhenNotLocalhost() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mailSender);

        SmtpInvitationDelivery delivery = new SmtpInvitationDelivery(
                provider,
                "noreply@lexorion.in",
                "http://horizon.lexorion.in"
        );

        assertThatThrownBy(() -> delivery.deliver(new InvitationDelivery.InvitationMessage(
                "invited@example.test", "Org", "org", "token", Instant.now())))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Invitation origin requires HTTPS (HTTP localhost allowed for development)");
    }

    @Test
    void rejectsOriginWithPathQueryOrFragment() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mailSender);

        for (String invalidOrigin : new String[]{
                "https://horizon.lexorion.in/extra-path",
                "https://horizon.lexorion.in?param=1",
                "https://horizon.lexorion.in#fragment",
                "https://user:pass@horizon.lexorion.in"
        }) {
            SmtpInvitationDelivery delivery = new SmtpInvitationDelivery(provider, "noreply@lexorion.in", invalidOrigin);
            assertThatThrownBy(() -> delivery.deliver(new InvitationDelivery.InvitationMessage(
                    "invited@example.test", "Org", "org", "token", Instant.now())))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Invitation origin requires HTTPS");
        }
    }

    @Test
    void throwsIllegalStateExceptionWhenSenderOrOriginOrMailMissingOrNull() {
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> providerWithoutMail = mock(ObjectProvider.class);
        when(providerWithoutMail.getIfAvailable()).thenReturn(null);

        // Missing JavaMailSender bean
        SmtpInvitationDelivery deliveryNoMail = new SmtpInvitationDelivery(providerWithoutMail, "from@test.local", "http://localhost");
        assertThatThrownBy(() -> deliveryNoMail.deliver(new InvitationDelivery.InvitationMessage(
                "invited@example.test", "Org", "org", "token", Instant.now())))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Invitation SMTP sender and public origin must be configured");

        JavaMailSender mailSender = mock(JavaMailSender.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> providerWithMail = mock(ObjectProvider.class);
        when(providerWithMail.getIfAvailable()).thenReturn(mailSender);

        // Null / blank from
        for (String invalidFrom : new String[]{null, "", "   "}) {
            SmtpInvitationDelivery delivery = new SmtpInvitationDelivery(providerWithMail, invalidFrom, "http://localhost");
            assertThatThrownBy(() -> delivery.deliver(new InvitationDelivery.InvitationMessage(
                    "invited@example.test", "Org", "org", "token", Instant.now())))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessage("Invitation SMTP sender and public origin must be configured");
        }

        // Null / blank origin
        for (String invalidOrigin : new String[]{null, "", "   "}) {
            SmtpInvitationDelivery delivery = new SmtpInvitationDelivery(providerWithMail, "from@test.local", invalidOrigin);
            assertThatThrownBy(() -> delivery.deliver(new InvitationDelivery.InvitationMessage(
                    "invited@example.test", "Org", "org", "token", Instant.now())))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessage("Invitation SMTP sender and public origin must be configured");
        }
    }
}
