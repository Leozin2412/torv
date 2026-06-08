-- 1. Configuration (Certifique-se que o nome do banco está idêntico)
ALTER DATABASE TorvDB SET RECOVERY FULL;
GO

DECLARE @CurrentDate VARCHAR(20) = FORMAT(GETDATE(), 'yyyyMMdd_HHmmss');
DECLARE @DestinationFolder VARCHAR(500) = 'C:\SQLBackups\';

-- Criamos caminhos completos aqui
DECLARE @FullBackupPath VARCHAR(500) = @DestinationFolder + 'torv_full_' + @CurrentDate + '.bak';
DECLARE @LogBackupPath VARCHAR(500) = @DestinationFolder + 'torv_log_' + @CurrentDate + '.trn';

-- 2. Full Backup Execution
-- Corrigimos concatenando a variável dentro da string
DECLARE @SqlBackupFull NVARCHAR(MAX) = N'BACKUP DATABASE TorvDB TO DISK = ''' + @FullBackupPath + ''' WITH FORMAT, INIT;';
EXEC sp_executesql @SqlBackupFull;

-- 3. Transaction Log Backup Execution
DECLARE @SqlBackupLog NVARCHAR(MAX) = N'BACKUP LOG TorvDB TO DISK = ''' + @LogBackupPath + ''';';
EXEC sp_executesql @SqlBackupLog;
GO