-- Відповідає за структуру MySQL: довідник працівників, оперативний журнал змін, аудит сканів та журнал синхронізацій.

CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  external_code VARCHAR(64) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  department VARCHAR(255) NULL,
  position VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  source_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_external_code (external_code),
  KEY idx_employees_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS work_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NULL,
  duration_minutes INT UNSIGNED NULL,
  status ENUM('OPEN', 'CLOSED', 'OVERTIME') NOT NULL DEFAULT 'OPEN',
  terminal_start_id VARCHAR(128) NULL,
  terminal_end_id VARCHAR(128) NULL,
  exported_to_sheet_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_work_log_employee_open (employee_id, status, end_time),
  KEY idx_work_log_export (exported_to_sheet_at),
  CONSTRAINT fk_work_log_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS punch_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_code VARCHAR(64) NOT NULL,
  employee_id BIGINT UNSIGNED NULL,
  event_type ENUM('START', 'END', 'REJECTED') NOT NULL,
  terminal_id VARCHAR(128) NULL,
  request_id VARCHAR(128) NULL,
  result ENUM('OK', 'ERROR') NOT NULL,
  message VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_punch_events_employee_code (employee_code),
  KEY idx_punch_events_request_id (request_id),
  CONSTRAINT fk_punch_events_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type ENUM('EMPLOYEES_IMPORT', 'WORK_LOG_EXPORT') NOT NULL,
  status ENUM('STARTED', 'SUCCESS', 'FAILED') NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  message VARCHAR(1000) NULL,
  PRIMARY KEY (id),
  KEY idx_sync_log_type_started (type, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
