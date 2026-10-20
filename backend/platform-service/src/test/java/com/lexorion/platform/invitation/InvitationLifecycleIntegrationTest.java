package com.lexorion.platform.invitation;

import com.jayway.jsonpath.JsonPath;
import com.lexorion.core.organization.entity.*;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.user.entity.*;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.horizon.invitation.delivery.InvitationDelivery;
import com.lexorion.horizon.invitation.repository.OrganizationInvitationRepository;
import com.lexorion.horizon.membership.entity.*;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.horizon.workspace.service.HorizonProvisioningService;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @Transactional
class InvitationLifecycleIntegrationTest {
    @Autowired MockMvc mvc; @Autowired UserRepository users; @Autowired OrganizationRepository organizations;
    @Autowired OrganizationMembershipRepository memberships; @Autowired OrganizationInvitationRepository invitations;
    @Autowired HorizonProvisioningService horizon; @Autowired PasswordEncoder encoder;
    @MockitoBean InvitationDelivery delivery;
    Organization org; String admin; InvitationDelivery.InvitationMessage delivered;
    @BeforeEach void setup() throws Exception {
        org = new Organization(); org.setName("Invitation QA"); org.setSlug("invite-qa"); org.setOrganizationCode("INVITE-QA");
        org.setPrimaryEmail("admin@invite.test"); org.setStatus(OrganizationStatus.ACTIVE); org = organizations.saveAndFlush(org); horizon.enroll(org.getId());
        User user = user("admin@invite.test");
        OrganizationMembership member = new OrganizationMembership(); member.setOrganization(org); member.setUser(user); member.setRole(OrganizationRole.ADMIN); member.setStatus(MembershipStatus.ACTIVE); member.setJoinedAt(Instant.now()); memberships.saveAndFlush(member);
        admin = login(user.getEmail());
        doAnswer(i -> { delivered = i.getArgument(0); return null; }).when(delivery).deliver(any());
    }
    @Test void newAccountAcceptanceCreatesMembershipAndAuthorizesOrganizationAccess() throws Exception {
        invite("new@invite.test").andExpect(status().isCreated()).andExpect(jsonPath("$.deliveryStatus").value("SUBMITTED"));
        String token = delivered.rawToken();
        publicPost("preview", "{\"token\":\""+token+"\"}").andExpect(jsonPath("$.accountExists").value(false));
        publicPost("register", "{\"token\":\""+token+"\",\"firstName\":\"New\",\"lastName\":\"Recipient\",\"password\":\"correct-password\"}").andExpect(status().isOk()).andExpect(jsonPath("$.organizationSlug").value("invite-qa"));
        User recipient = users.findByEmailIgnoreCase("new@invite.test").orElseThrow();
        assertThat(memberships.existsByOrganizationIdAndUserId(org.getId(), recipient.getId())).isTrue();
        access(login(recipient.getEmail())).andExpect(status().isOk());
        publicPost("register", "{\"token\":\""+token+"\",\"firstName\":\"New\",\"lastName\":\"Recipient\",\"password\":\"correct-password\"}").andExpect(status().isConflict());
    }
    @Test void existingAccountMustSignInAndCannotAcceptTwiceOrAsAnotherUser() throws Exception {
        user("existing@invite.test"); invite("existing@invite.test").andExpect(status().isCreated());
        String token=delivered.rawToken();
        publicPost("preview", tokenBody(token)).andExpect(jsonPath("$.accountExists").value(true));
        accept(token, admin).andExpect(status().isForbidden());
        String recipient=login("existing@invite.test");
        accept(token, recipient).andExpect(status().isOk());
        accept(token, recipient).andExpect(status().isConflict());
        invite("existing@invite.test").andExpect(status().isConflict());
        access(recipient).andExpect(status().isOk());
    }
    @Test void failedDeliveryPersistsAndResendRotatesTokenWithoutDuplicateInvitation() throws Exception {
        doThrow(new IllegalStateException("provider-secret-must-not-leak")).when(delivery).deliver(any());
        String body=invite("retry@invite.test").andExpect(status().isCreated()).andExpect(jsonPath("$.deliveryStatus").value("FAILED")).andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("provider-secret");
        UUID id=UUID.fromString(JsonPath.read(body,"$.invitationId"));
        String oldHash=invitations.findById(id).orElseThrow().getTokenHash();
        invite("retry@invite.test").andExpect(status().isConflict());
        doAnswer(i->{delivered=i.getArgument(0);return null;}).when(delivery).deliver(any());
        tenant(post("/api/tenant/invitations/"+id+"/resend")).andExpect(status().isOk()).andExpect(jsonPath("$.deliveryStatus").value("SUBMITTED"));
        assertThat(invitations.findById(id).orElseThrow().getTokenHash()).isNotEqualTo(oldHash);
    }
    @Test void expiredRevokedAndWrongOrganizationAreRejected() throws Exception {
        user("blocked@invite.test"); user("expired@invite.test");
        String body=invite("blocked@invite.test").andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String token=delivered.rawToken(); UUID id=UUID.fromString(JsonPath.read(body,"$.invitationId"));
        mvc.perform(delete("/api/tenant/invitations/"+id).header("Host","localhost").header("Authorization","Bearer "+admin).header("X-Lexorion-Organization","wrong-org")).andExpect(status().isForbidden());
        tenant(delete("/api/tenant/invitations/"+id)).andExpect(status().isNoContent());
        publicPost("preview",tokenBody(token)).andExpect(status().isConflict());
        accept(token,login("blocked@invite.test")).andExpect(status().isConflict());
        tenant(post("/api/tenant/invitations/"+id+"/resend")).andExpect(status().isConflict());
        invite("expired@invite.test").andExpect(status().isCreated()); token=delivered.rawToken();
        var expired=invitations.findByTokenHash(new com.lexorion.horizon.invitation.service.InvitationTokenService().hash(token)).orElseThrow();
        expired.setExpiresAt(Instant.now().minusSeconds(1)); invitations.saveAndFlush(expired);
        publicPost("preview",tokenBody(token)).andExpect(status().isConflict());
        accept(token,login("expired@invite.test")).andExpect(status().isConflict());
        invite("expired@invite.test").andExpect(status().isCreated());
    }
    @Test void invitationCannotBeConsumedUnderAnotherSelectedOrganization() throws Exception {
        User recipient=user("cross@invite.test");
        Organization other=new Organization();other.setName("Other QA");other.setSlug("other-qa");other.setOrganizationCode("OTHER-QA");other.setPrimaryEmail("other@invite.test");other.setStatus(OrganizationStatus.ACTIVE);other=organizations.saveAndFlush(other);horizon.enroll(other.getId());
        OrganizationMembership member=new OrganizationMembership();member.setOrganization(other);member.setUser(recipient);member.setRole(OrganizationRole.EMPLOYEE);member.setStatus(MembershipStatus.ACTIVE);member.setJoinedAt(Instant.now());memberships.saveAndFlush(member);
        invite("cross@invite.test").andExpect(status().isCreated());
        mvc.perform(post("/api/invitations/accept").header("Host","localhost").header("Authorization","Bearer "+login(recipient.getEmail()))
            .header("X-Lexorion-Organization","other-qa").contentType(MediaType.APPLICATION_JSON).content(tokenBody(delivered.rawToken()))).andExpect(status().isForbidden());
        assertThat(memberships.existsByOrganizationIdAndUserId(org.getId(),recipient.getId())).isFalse();
        accept(delivered.rawToken(),login(recipient.getEmail())).andExpect(status().isOk());
    }

    private User user(String email) { var u=new User();u.setEmail(email);u.setFirstName("Test");u.setLastName("User");u.setPasswordHash(encoder.encode("correct-password"));u.setStatus(UserStatus.ACTIVE);return users.saveAndFlush(u); }
    private String login(String email)throws Exception {return JsonPath.read(mvc.perform(post("/api/core/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\""+email+"\",\"password\":\"correct-password\"}")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(),"$.accessToken");}
    private ResultActions invite(String email)throws Exception { return tenant(post("/api/tenant/invitations").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\""+email+"\",\"role\":\"EMPLOYEE\"}")); }
    private ResultActions tenant(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request)throws Exception {return mvc.perform(request.header("Host","localhost").header("Authorization","Bearer "+admin).header("X-Lexorion-Organization",org.getSlug()));}
    private ResultActions publicPost(String action,String body)throws Exception {return mvc.perform(post("/api/invitations/"+action).contentType(MediaType.APPLICATION_JSON).content(body));}
    private ResultActions accept(String token,String bearer)throws Exception {return mvc.perform(post("/api/invitations/accept").header("Authorization","Bearer "+bearer).contentType(MediaType.APPLICATION_JSON).content(tokenBody(token)));}
    private ResultActions access(String bearer)throws Exception {return mvc.perform(get("/api/tenant/workspaces/accessible").header("Host","localhost").header("Authorization","Bearer "+bearer).header("X-Lexorion-Organization",org.getSlug()));}
    private String tokenBody(String token){return "{\"token\":\""+token+"\"}";}
}
