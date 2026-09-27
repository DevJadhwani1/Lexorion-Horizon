package com.lexorion.workforce.service;

import java.sql.SQLException;
import java.util.UUID;
import javax.sql.DataSource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/** Inserts trusted Platform workspace identities idempotently on supported service databases. */
@Component
public class WorkforceWorkspaceProvisioner {
    private static final String POSTGRES_INSERT = """
            insert into workforce_workspaces(id, workspace_key, created_at, updated_at)
            values (:id, :key, current_timestamp, current_timestamp)
            on conflict (id) do nothing
            """;
    private static final String H2_INSERT = """
            merge into workforce_workspaces target
            using (values (:id, :key, current_timestamp, current_timestamp)) source(id, workspace_key, created_at, updated_at)
            on target.id = source.id
            when not matched then insert (id, workspace_key, created_at, updated_at)
            values (source.id, source.workspace_key, source.created_at, source.updated_at)
            """;

    private static final String H2_CHECK = "select id from workforce_workspaces where id = :id for update";

    private final NamedParameterJdbcTemplate jdbc;
    private final String insertSql;
    private final boolean h2;

    public WorkforceWorkspaceProvisioner(DataSource dataSource) {
        this.jdbc = new NamedParameterJdbcTemplate(dataSource);
        try (var connection = dataSource.getConnection()) {
            var metadata = connection.getMetaData();
            String url = metadata.getURL();
            String database = metadata.getDatabaseProductName();
            if (url != null && url.startsWith("jdbc:h2:")) {
                // H2 PostgreSQL compatibility mode also reports its product name
                // as PostgreSQL, so identify it by the actual JDBC URL first.
                this.insertSql = H2_INSERT;
                this.h2 = true;
            } else if ("PostgreSQL".equalsIgnoreCase(database)) {
                this.insertSql = POSTGRES_INSERT;
                this.h2 = false;
            } else {
                throw new IllegalStateException("Unsupported Workforce database for idempotent workspace provisioning: " + database);
            }
        } catch (SQLException ex) {
            throw new IllegalStateException("Could not identify Workforce database dialect", ex);
        }
    }

    public void ensureExists(UUID id, String key) {
        if (h2) {
            synchronized (H2_LOCKS.computeIfAbsent(id, ignored -> new Object())) {
                try {
                    jdbc.queryForObject(H2_CHECK, new MapSqlParameterSource("id", id), UUID.class);
                } catch (org.springframework.dao.EmptyResultDataAccessException missing) {
                    try {
                        jdbc.update(insertSql, new MapSqlParameterSource().addValue("id", id).addValue("key", key));
                    } catch (DuplicateKeyException concurrentProvision) {
                        // H2 MERGE is not atomic against concurrent inserts. The
                        // caller's following FOR UPDATE read verifies the row.
                    }
                }
            }
            return;
        }
        try {
            jdbc.update(insertSql, new MapSqlParameterSource().addValue("id", id).addValue("key", key));
        } catch (DuplicateKeyException race) {
            throw race;
        }
    }

    private static final java.util.concurrent.ConcurrentMap<UUID, Object> H2_LOCKS = new java.util.concurrent.ConcurrentHashMap<>();
}
