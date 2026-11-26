-- W-77: קטגוריה חדשה "קטלוג" בספריית העיצובים (הקטלוג של הושעיה — 134 תמונות לדירוג המשפחה). אידמפוטנטי.
alter table public.design_library drop constraint if exists design_library_category_check;
alter table public.design_library add constraint design_library_category_check
  check (category = any (array['כוסות','מזוזות','תמונות','מחזיקי מפתחות','אחר','קטלוג']));
