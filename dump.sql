-- START DUMP estok_categories --
-- ENOENT: no such file or directory, copyfile '/var/lib/manticore/estok_categories/exceptions.txt' -> '/Users/igorkhomenko/projects/packages/manticoresearch-dump/estok_categories/exceptions.txt' --
-- ENOENT: no such file or directory, copyfile '/var/lib/manticore/estok_categories/ru.stopwords.txt' -> '/Users/igorkhomenko/projects/packages/manticoresearch-dump/estok_categories/ru.stopwords.txt' --
-- ENOENT: no such file or directory, copyfile '/var/lib/manticore/estok_categories/wordforms.categories.txt' -> '/Users/igorkhomenko/projects/packages/manticoresearch-dump/estok_categories/wordforms.categories.txt' --
CREATE TABLE estok_categories (
root integer,
parent integer,
priority integer,
items integer,
realcat integer,
alias string attribute,
ru_name string attribute,
ua_name string attribute,
type string attribute,
filters string attribute,
term text
) min_infix_len='2' index_exact_words='1' index_field_lengths='1' exceptions='/Users/igorkhomenko/projects/packages/manticoresearch-dump/estok_categories/exceptions.txt' morphology='lemmatize_ru_all' min_stemming_len='3' stopwords='/Users/igorkhomenko/projects/packages/manticoresearch-dump/estok_categories/ru.stopwords.txt' wordforms='/Users/igorkhomenko/projects/packages/manticoresearch-dump/estok_categories/wordforms.categories.txt' expand_keywords='1';
INSERT INTO estok_categories (id,root,parent,priority,items,realcat,alias,ru_name,ua_name,type,filters,term) VALUES(1,0,0,0,0,0,'ads-all','Все объявления','Усі оголошення','root','','Все объявления Усі оголошення'),(3,1,27,0,2018,0,'mobilnye-telefony','Мобильные телефоны | Смартфоны','Мобільні телефони | Смартфони','final','','Мобильные телефоны | Смартфоны Мобільні телефони | Смартфони'),(4,1,27,0,0,0,'accessories-mobilnye-telefony','Акссесуары','Аксесуари','section','','Акссесуары Аксесуари'),(5,1,4,0,5,0,'accessories-dlya-smartfonov','Аксессуары для смартфонов','Аксесуари для смартфонів','final','','Аксессуары для смартфонов Аксесуари для смартфонів'),(6,1,1,0,0,0,'noutbuki-planshety-komputery','Ноутбуки, планшеты, компьютеры ','Ноутбуки, планшети, комп\'ютери','main','','Ноутбуки, планшеты, компьютеры  Ноутбуки, планшети, комп\'ютери');
-- COUNT: 5 --
-- END DUMP estok_categories --

-- TIME: 0.34s --
