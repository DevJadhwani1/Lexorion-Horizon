package com.lexorion.horizon.invitation.delivery;

import java.net.URI;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** SMTP is an external boundary. Missing configuration is a delivery failure, never success. */
@Component
public class SmtpInvitationDelivery implements InvitationDelivery {
    private final ObjectProvider<JavaMailSender> sender;
    private final String from;
    private final String origin;
    public SmtpInvitationDelivery(ObjectProvider<JavaMailSender> sender,
            @Value("${lexorion.invitations.from:}") String from,
            @Value("${lexorion.invitations.public-origin:}") String origin) {
        this.sender = sender; this.from = from; this.origin = origin;
    }
    @Override public void deliver(InvitationMessage invitation) {
        JavaMailSender mail = sender.getIfAvailable();
        if (mail == null || from == null || from.isBlank() || origin == null || origin.isBlank())
            throw new IllegalStateException("Invitation SMTP sender and public origin must be configured");
        URI uri = URI.create(origin);
        if ((!uri.getPath().isEmpty() && !uri.getPath().equals("/")) || uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                || !("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme()) && "localhost".equals(uri.getHost()))))
            throw new IllegalStateException("Invitation origin requires HTTPS (HTTP localhost allowed for development)");
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from); message.setTo(invitation.recipientEmail());
        message.setSubject("Invitation to " + invitation.organizationName());
        message.setText("You have been invited to " + invitation.organizationName() + " (" + invitation.organizationSlug()
                + ").\nOpen " + origin.replaceAll("/$", "") + "/invitations/accept#token=" + invitation.rawToken()
                + "\nThis invitation expires at " + invitation.expiresAt() + ".\nIf you did not expect this invitation, ignore it.");
        mail.send(message);
    }
}
