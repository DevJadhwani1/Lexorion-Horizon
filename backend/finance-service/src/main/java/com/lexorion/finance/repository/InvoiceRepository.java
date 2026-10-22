package com.lexorion.finance.repository;

import com.lexorion.finance.domain.Invoice;
import com.lexorion.finance.domain.InvoiceStatus;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
    @EntityGraph(attributePaths = "client")
    @Query("""
            select i from Invoice i
            where i.workspace.id = :workspaceId
              and (:status is null or i.status = :status)
              and (:clientKey is null or i.client.clientKey = :clientKey)
              and (:overdueOnly = false or (i.status in (com.lexorion.finance.domain.InvoiceStatus.ISSUED, com.lexorion.finance.domain.InvoiceStatus.PARTIALLY_PAID) and i.dueDate < :today))
            """)
    Page<Invoice> search(@Param("workspaceId") UUID workspaceId, @Param("status") InvoiceStatus status,
            @Param("clientKey") String clientKey, @Param("overdueOnly") boolean overdueOnly, @Param("today") LocalDate today,
            Pageable pageable);

    @EntityGraph(attributePaths = {"client", "lines"})
    Optional<Invoice> findByWorkspaceIdAndInvoiceNumber(UUID workspaceId, String invoiceNumber);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.workspace.id = :workspaceId and i.invoiceNumber = :invoiceNumber")
    Optional<Invoice> findScopedForUpdate(@Param("workspaceId") UUID workspaceId, @Param("invoiceNumber") String invoiceNumber);

    @EntityGraph(attributePaths = "client")
    List<Invoice> findByWorkspaceIdAndStatusIn(UUID workspaceId, Collection<InvoiceStatus> statuses);

    @Query("select count(i) from Invoice i where i.workspace.id = :workspaceId and i.status = :status")
    long countByStatus(@Param("workspaceId") UUID workspaceId, @Param("status") InvoiceStatus status);

    @Query("""
            select i.currency, sum(i.total) from Invoice i
            where i.workspace.id = :workspaceId and i.status <> com.lexorion.finance.domain.InvoiceStatus.DRAFT
              and i.status <> com.lexorion.finance.domain.InvoiceStatus.VOID
              and i.issueDate between :from and :to
            group by i.currency
            """)
    List<Object[]> invoicedBetween(@Param("workspaceId") UUID workspaceId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Outstanding balance and open-invoice count per client, for the client list. */
    @Query("""
            select i.client.id, sum(i.total - i.amountPaid), count(i) from Invoice i
            where i.workspace.id = :workspaceId
              and i.status in (com.lexorion.finance.domain.InvoiceStatus.ISSUED, com.lexorion.finance.domain.InvoiceStatus.PARTIALLY_PAID)
            group by i.client.id
            """)
    List<Object[]> outstandingByClient(@Param("workspaceId") UUID workspaceId);
}
