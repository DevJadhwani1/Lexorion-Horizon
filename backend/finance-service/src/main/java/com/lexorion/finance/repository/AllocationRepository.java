package com.lexorion.finance.repository;

import com.lexorion.finance.domain.Allocation;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AllocationRepository extends JpaRepository<Allocation, UUID> {
    @EntityGraph(attributePaths = {"receipt", "receipt.client", "invoice"})
    List<Allocation> findByInvoiceIdAndReversedAtIsNullOrderByCreatedAtAsc(UUID invoiceId);

    List<Allocation> findByReceiptId(UUID receiptId);

    @EntityGraph(attributePaths = {"invoice"})
    List<Allocation> findByReceiptIdAndReversedAtIsNull(UUID receiptId);

    boolean existsByInvoiceIdAndReversedAtIsNull(UUID invoiceId);

    @Query("select coalesce(sum(a.amount), 0) from Allocation a where a.receipt.id = :receiptId and a.reversedAt is null")
    BigDecimal activeTotal(@Param("receiptId") UUID receiptId);

    @Query("select coalesce(sum(a.amount), 0) from Allocation a where a.invoice.id = :invoiceId and a.reversedAt is null")
    BigDecimal activeOnInvoice(@Param("invoiceId") UUID invoiceId);

    @Query("""
            select a.receipt.id, coalesce(sum(a.amount), 0) from Allocation a
            where a.reversedAt is null and a.receipt.id in :receiptIds
            group by a.receipt.id
            """)
    List<Object[]> activeTotals(@Param("receiptIds") Collection<UUID> receiptIds);

    @Query("""
            select coalesce(sum(a.amount), 0) from Allocation a
            where a.invoice.id = :invoiceId and a.receipt.paymentDate <= :asOf
              and (a.reversedAt is null or a.reversedAt >= :reversedAfter)
            """)
    BigDecimal appliedAsOf(@Param("invoiceId") UUID invoiceId, @Param("asOf") LocalDate asOf, @Param("reversedAfter") Instant reversedAfter);

    @Query("""
            select r.currency, coalesce(sum(a.amount), 0) from Allocation a join a.receipt r
            where r.workspace.id = :workspaceId and a.reversedAt is null and r.paymentDate between :from and :to
            group by r.currency
            """)
    List<Object[]> allocatedBetween(@Param("workspaceId") UUID workspaceId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
