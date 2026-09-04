package com.lexorion.platform.workspace.service;

import com.lexorion.platform.exception.DuplicateResourceException;
import com.lexorion.platform.exception.ResourceNotFoundException;
import com.lexorion.platform.membership.entity.OrganizationRole;
import com.lexorion.platform.organization.entity.Organization;
import com.lexorion.platform.organization.repository.OrganizationRepository;
import com.lexorion.platform.product.entity.Product;
import com.lexorion.platform.product.entity.ProductStatus;
import com.lexorion.platform.product.repository.ProductRepository;
import com.lexorion.platform.tenantaccess.context.TenantAccessContext;
import com.lexorion.platform.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.platform.workspace.dto.CreateWorkspaceRequest;
import com.lexorion.platform.workspace.dto.UpdateWorkspaceRequest;
import com.lexorion.platform.workspace.dto.WorkspaceResponse;
import com.lexorion.platform.workspace.entity.OrganizationWorkspace;
import com.lexorion.platform.workspace.entity.WorkspaceStatus;
import com.lexorion.platform.workspace.exception.InvalidWorkspaceException;
import com.lexorion.platform.workspace.repository.OrganizationWorkspaceRepository;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class WorkspaceAdministrationService {
    private final TenantAccessContextHolder contextHolder;
    private final OrganizationRepository organizationRepository;
    private final ProductRepository productRepository;
    private final OrganizationWorkspaceRepository workspaceRepository;

    public WorkspaceAdministrationService(TenantAccessContextHolder contextHolder,
                                          OrganizationRepository organizationRepository,
                                          ProductRepository productRepository,
                                          OrganizationWorkspaceRepository workspaceRepository) {
        this.contextHolder = contextHolder; this.organizationRepository = organizationRepository;
        this.productRepository = productRepository; this.workspaceRepository = workspaceRepository;
    }

    @Transactional(readOnly = true)
    public List<WorkspaceResponse> list() {
        TenantAccessContext context = requireAdministrator();
        return workspaceRepository.findTenantWorkspaces(context.organizationId()).stream()
                .map(WorkspaceResponse::from).toList();
    }

    public WorkspaceResponse create(CreateWorkspaceRequest request) {
        TenantAccessContext context = requireAdministrator();
        Organization organization = lockMutableOrganization(context);
        Product product = productRepository.findByKey(request.productKey())
                .orElseThrow(() -> new InvalidWorkspaceException("Product is not available for provisioning"));
        if (product.getStatus() != ProductStatus.ACTIVE) {
            throw new InvalidWorkspaceException("Product is not available for provisioning");
        }
        if (workspaceRepository.existsByOrganizationIdAndKey(organization.getId(), request.key())) {
            throw new DuplicateResourceException("Workspace key already exists in this organization: " + request.key());
        }
        OrganizationWorkspace workspace = new OrganizationWorkspace(); workspace.setOrganization(organization);
        workspace.setProduct(product); workspace.setKey(request.key());
        workspace.setDisplayName(requireName(request.displayName())); workspace.setStatus(WorkspaceStatus.ACTIVE);
        try { return WorkspaceResponse.from(workspaceRepository.saveAndFlush(workspace)); }
        catch (DataIntegrityViolationException ex) {
            throw new DuplicateResourceException("Workspace key already exists in this organization: " + request.key());
        }
    }

    public WorkspaceResponse update(String key, UpdateWorkspaceRequest request) {
        TenantAccessContext context = requireAdministrator();
        lockMutableOrganization(context);
        OrganizationWorkspace workspace = findScoped(context, key);
        if (request.displayName() != null) workspace.setDisplayName(requireName(request.displayName()));
        if (request.status() != null) {
            if (request.status() == WorkspaceStatus.ACTIVE && workspace.getProduct().getStatus() != ProductStatus.ACTIVE) {
                throw new InvalidWorkspaceException("Workspace cannot be activated while its product is inactive");
            }
            workspace.setStatus(request.status());
        }
        return WorkspaceResponse.from(workspaceRepository.saveAndFlush(workspace));
    }

    public void deactivate(String key) {
        TenantAccessContext context = requireAdministrator();
        lockMutableOrganization(context);
        OrganizationWorkspace workspace = findScoped(context, key);
        workspace.setStatus(WorkspaceStatus.INACTIVE); workspaceRepository.saveAndFlush(workspace);
    }

    private TenantAccessContext requireAdministrator() {
        TenantAccessContext context = contextHolder.get()
                .orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
        if (context.membershipRole() != OrganizationRole.OWNER && context.membershipRole() != OrganizationRole.ADMIN) {
            throw new AccessDeniedException("Workspace administration requires OWNER or ADMIN");
        }
        return context;
    }

    private Organization lockMutableOrganization(TenantAccessContext context) {
        Organization organization = organizationRepository.findByIdForUpdate(context.organizationId())
                .orElseThrow(() -> ResourceNotFoundException.of("Organization", context.organizationId()));
        if (!organization.getStatus().allowsTenantManagement()) {
            throw new InvalidWorkspaceException("Workspace administration requires a TRIAL or ACTIVE organization");
        }
        return organization;
    }

    private OrganizationWorkspace findScoped(TenantAccessContext context, String key) {
        return workspaceRepository.findTenantWorkspace(context.organizationId(), key)
                .orElseThrow(() -> new ResourceNotFoundException("Workspace not found: " + key));
    }

    private static String requireName(String value) {
        String normalized = value.trim();
        if (normalized.isEmpty()) throw new InvalidWorkspaceException("displayName must not be blank");
        return normalized;
    }
}
