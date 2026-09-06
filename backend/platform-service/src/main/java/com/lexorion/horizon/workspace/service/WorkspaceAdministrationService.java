package com.lexorion.horizon.workspace.service;

import com.lexorion.core.exception.DuplicateResourceException;
import com.lexorion.core.exception.ResourceNotFoundException;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.horizon.product.entity.Product;
import com.lexorion.horizon.product.entity.ProductStatus;
import com.lexorion.horizon.product.repository.ProductRepository;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContext;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.horizon.workspace.dto.CreateWorkspaceRequest;
import com.lexorion.horizon.workspace.dto.UpdateWorkspaceRequest;
import com.lexorion.horizon.workspace.dto.WorkspaceResponse;
import com.lexorion.horizon.workspace.entity.OrganizationWorkspace;
import com.lexorion.horizon.workspace.entity.WorkspaceStatus;
import com.lexorion.horizon.workspace.exception.InvalidWorkspaceException;
import com.lexorion.horizon.workspace.repository.OrganizationWorkspaceRepository;
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
    private final com.lexorion.horizon.entitlement.service.EntitlementService entitlements;

    public WorkspaceAdministrationService(TenantAccessContextHolder contextHolder,
                                          OrganizationRepository organizationRepository,
                                          ProductRepository productRepository,
                                          OrganizationWorkspaceRepository workspaceRepository, com.lexorion.horizon.entitlement.service.EntitlementService entitlements) {
        this.contextHolder = contextHolder; this.organizationRepository = organizationRepository;
        this.productRepository = productRepository; this.workspaceRepository = workspaceRepository;
        this.entitlements = entitlements;
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
        var keys = new java.util.LinkedHashSet<String>();
        if (request.productKey() != null) keys.add(request.productKey());
        if (request.productKeys() != null) keys.addAll(request.productKeys());
        if (keys.isEmpty()) throw new InvalidWorkspaceException("At least one product is required");
        Product product = productRepository.findByKey(keys.iterator().next())
                .orElseThrow(() -> new InvalidWorkspaceException("Product is not available for provisioning"));
        if (product.getStatus() != ProductStatus.ACTIVE) {
            throw new InvalidWorkspaceException("Product is not available for provisioning");
        }
        if (workspaceRepository.existsByOrganizationIdAndKey(organization.getId(), request.key())) {
            throw new DuplicateResourceException("Workspace key already exists in this organization: " + request.key());
        }
        requireCapacity(context, product.getKey());
        OrganizationWorkspace workspace = new OrganizationWorkspace(); workspace.setOrganization(organization);
        workspace.setProduct(product); workspace.setKey(request.key());
        for (String productKey : keys) {
            Product attached = productRepository.findByKey(productKey).filter(p -> p.getStatus() == ProductStatus.ACTIVE)
                .orElseThrow(() -> new InvalidWorkspaceException("Product is unavailable"));
            workspace.getProducts().add(attached);
        }
        for (String productKey : keys) entitlements.requireEffectivePlan(workspace, productKey);
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
        if (request.productKeys() != null) {
            if (!request.productKeys().contains(workspace.getProduct().getKey())) throw new InvalidWorkspaceException("The existing primary product must be retained");
            var attached = new java.util.HashSet<Product>();
            for (String productKey : request.productKeys()) attached.add(productRepository.findByKey(productKey).filter(p -> p.getStatus() == ProductStatus.ACTIVE).orElseThrow(() -> new InvalidWorkspaceException("Product is unavailable")));
            workspace.setProducts(attached);
            for (String productKey : request.productKeys()) entitlements.requireEffectivePlan(workspace, productKey);
        }
        if (request.displayName() != null) workspace.setDisplayName(requireName(request.displayName()));
        if (request.status() != null) {
            if (request.status() == WorkspaceStatus.ACTIVE && workspace.getStatus() != WorkspaceStatus.ACTIVE) requireCapacity(context, workspace.getProduct().getKey());
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
        if (context.membershipRole() != OrganizationRole.ADMIN) {
            throw new AccessDeniedException("Workspace administration requires ADMIN");
        }
        return context;
    }
    private void requireCapacity(TenantAccessContext context, String productKey) {
        long active = workspaceRepository.findTenantWorkspaces(context.organizationId()).stream().filter(w -> w.getStatus() == WorkspaceStatus.ACTIVE).count();
        entitlements.requireWorkspaceCapacity(productKey, active + 1);
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
