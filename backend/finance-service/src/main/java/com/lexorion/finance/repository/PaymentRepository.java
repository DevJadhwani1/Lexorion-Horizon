package com.lexorion.finance.repository;

import com.lexorion.finance.domain.Payment;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    @EntityGraph(attributePaths = {"invoice", "invoice.client", "client"})
    Page<Payment> findByWorkspaceId(UUID workspaceId, Pageable pageable);

    @EntityGraph(attributePaths = {"client"})
    Optional<Payment> findByWorkspaceIdAndReceiptNumber(UUID workspaceId, String receiptNumber);

    @EntityGraph(attributePaths = "client")
    List<Payment> findByWorkspaceIdAndClientId(UUID workspaceId, UUID clientId);

    @EntityGraph(attributePaths = {"invoice", "invoice.client"})
    List<Payment> findByInvoiceIdOrderByPaymentDateAscReceiptNumberAsc(UUID invoiceId);

    boolean existsByInvoiceId(UUID invoiceId);

    @Query("""
            select p.currency, sum(p.amount) from Payment p
            where p.workspace.id = :workspaceId and p.paymentDate between :from and :to
            group by p.currency
            """)
    List<Object[]> receivedBetween(@Param("workspaceId") UUID workspaceId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}
