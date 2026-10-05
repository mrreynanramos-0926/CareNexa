CREATE TABLE "role_module_access" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "access" TEXT NOT NULL
);

CREATE UNIQUE INDEX "role_module_access_role_module_key" ON "role_module_access"("role", "module");

INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_dashboard', 'ADMIN', 'dashboard', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_customers', 'ADMIN', 'customers', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_segments', 'ADMIN', 'segments', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_orders', 'ADMIN', 'orders', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_dermtechs', 'ADMIN', 'dermtechs', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_catalog', 'ADMIN', 'catalog', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_inventory', 'ADMIN', 'inventory', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_marketing', 'ADMIN', 'marketing', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_promotions', 'ADMIN', 'promotions', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_analytics', 'ADMIN', 'analytics', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_insights', 'ADMIN', 'insights', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_reports', 'ADMIN', 'reports', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_commissions', 'ADMIN', 'commissions', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_users', 'ADMIN', 'users', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_audit', 'ADMIN', 'audit', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_business', 'ADMIN', 'business', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_settings', 'ADMIN', 'settings', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_payments', 'ADMIN', 'payments', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_admin_access', 'ADMIN', 'access', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_dashboard', 'MANAGER', 'dashboard', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_customers', 'MANAGER', 'customers', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_segments', 'MANAGER', 'segments', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_orders', 'MANAGER', 'orders', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_dermtechs', 'MANAGER', 'dermtechs', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_catalog', 'MANAGER', 'catalog', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_inventory', 'MANAGER', 'inventory', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_marketing', 'MANAGER', 'marketing', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_promotions', 'MANAGER', 'promotions', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_analytics', 'MANAGER', 'analytics', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_insights', 'MANAGER', 'insights', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_reports', 'MANAGER', 'reports', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_commissions', 'MANAGER', 'commissions', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_users', 'MANAGER', 'users', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_audit', 'MANAGER', 'audit', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_business', 'MANAGER', 'business', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_settings', 'MANAGER', 'settings', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_payments', 'MANAGER', 'payments', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_manager_access', 'MANAGER', 'access', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_dashboard', 'STAFF', 'dashboard', 'view');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_customers', 'STAFF', 'customers', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_segments', 'STAFF', 'segments', 'view');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_orders', 'STAFF', 'orders', 'manage');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_dermtechs', 'STAFF', 'dermtechs', 'view');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_catalog', 'STAFF', 'catalog', 'view');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_inventory', 'STAFF', 'inventory', 'view');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_marketing', 'STAFF', 'marketing', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_promotions', 'STAFF', 'promotions', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_analytics', 'STAFF', 'analytics', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_insights', 'STAFF', 'insights', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_reports', 'STAFF', 'reports', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_commissions', 'STAFF', 'commissions', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_users', 'STAFF', 'users', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_audit', 'STAFF', 'audit', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_business', 'STAFF', 'business', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_settings', 'STAFF', 'settings', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_payments', 'STAFF', 'payments', 'none');
INSERT INTO "role_module_access" ("id", "role", "module", "access") VALUES ('acc_staff_access', 'STAFF', 'access', 'none');
