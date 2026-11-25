-- Register permite os seis objetivos juntos (119 caracteres); VarChar(100) estourava.
ALTER TABLE user_profiles ALTER COLUMN goal TYPE varchar(255);
