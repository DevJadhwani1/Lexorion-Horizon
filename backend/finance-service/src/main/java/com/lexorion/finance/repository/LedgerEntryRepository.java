package com.lexorion.finance.repository;

import com.lexorion.finance.domain.LedgerAccount;
import com.lexorion.finance.domain.LedgerEntry;
import com.lexorion.finance.domain.VoucherType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, UUID> {
    boolean existsByWorkspaceIdAndVoucherTypeAndSourceId(UUID workspaceId, VoucherType voucherType, UUID sourceId);

    List<LedgerEntry> findByWorkspaceIdAndVoucherTypeAndSourceId(UUID workspaceId, VoucherType voucherType, UUID sourceId);

    @EntityGraph(attributePaths = {"client", "invoice"})
    @Query("""
            select e from LedgerEntry e where e.workspace.id = :workspaceId and e.entryDate between :from and :to
            order by e.entryDate, e.createdAt, e.voucherNumber, e.account
            """)
    List<LedgerEntry> findPeriod(@Param("workspaceId") UUID workspaceId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Net (debit − credit) of an account per currency before a date: the opening balance of a period. */
    @Query("""
            select e.currency, sum(e.debit - e.credit) from LedgerEntry e
            where e.workspace.id = :workspaceId and e.account = :account and e.entryDate < :before
            group by e.currency
            """)
    List<Object[]> balanceBefore(@Param("workspaceId") UUID workspaceId, @Param("account") LedgerAccount account, @Param("before") LocalDate before);

    @Query("""
            select e.currency, sum(e.debit - e.credit) from LedgerEntry e
            where e.workspace.id = :workspaceId and e.client.id = :clientId and e.account = com.lexorion.finance.domain.LedgerAccount.RECEIVABLES
              and e.entryDate < :before
            group by e.currency
            """)
    List<Object[]> clientBalanceBefore(@Param("workspaceId") UUID workspaceId, @Param("clientId") UUID clientId, @Param("before") LocalDate before);

    @EntityGraph(attributePaths = {"invoice"})
    @Query("""
            select e from LedgerEntry e
            where e.workspace.id = :workspaceId and e.client.id = :clientId and e.account = com.lexorion.finance.domain.LedgerAccount.RECEIVABLES
              and e.entryDate between :from and :to
            order by e.entryDate, e.createdAt, e.voucherNumber
            """)
    List<LedgerEntry> clientReceivables(@Param("workspaceId") UUID workspaceId, @Param("clientId") UUID clientId,
            @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select min(e.entryDate) from LedgerEntry e where e.workspace.id = :workspaceId")
    LocalDate firstEntryDate(@Param("workspaceId") UUID workspaceId);

    @Query("select coalesce(sum(e.debit), 0) - coalesce(sum(e.credit), 0) from LedgerEntry e where e.workspace.id = :workspaceId")
    BigDecimal imbalance(@Param("workspaceId") UUID workspaceId);
}
