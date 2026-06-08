RESTORE DATABASE TorvDB_Teste 
FROM DISK = 'C:\SQLBackups\torv_full_20260607_202913.bak' WITH REPLACE, RECOVERY;

use TorvDB_Teste

select * from users
