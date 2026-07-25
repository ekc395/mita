-- Local dev fixtures. Applied by `supabase db reset` after the migrations.
--
-- These rows exist so the app has something to join against before the AniList
-- sync has ever run; the real cache is filled server-side on first search/log,
-- which will overwrite these on conflict. Treat the metadata as placeholder.

insert into public.anime
  (anilist_id, title_romaji, title_english, format, status, season, season_year,
   episodes, genres, average_score)
values
  (1,      'Cowboy Bebop',           'Cowboy Bebop',
   'TV', 'FINISHED', 'SPRING', 1998, 26, '{Action,Adventure,Sci-Fi}',        86),
  (5114,   'Hagane no Renkinjutsushi: Fullmetal Alchemist',
                                     'Fullmetal Alchemist: Brotherhood',
   'TV', 'FINISHED', 'SPRING', 2009, 64, '{Action,Adventure,Drama,Fantasy}', 90),
  (9253,   'Steins;Gate',            'Steins;Gate',
   'TV', 'FINISHED', 'SPRING', 2011, 24, '{Drama,Sci-Fi,Thriller}',          88),
  (16498,  'Shingeki no Kyojin',     'Attack on Titan',
   'TV', 'FINISHED', 'SPRING', 2013, 25, '{Action,Drama,Fantasy}',           84),
  (21507,  'Mob Psycho 100',         'Mob Psycho 100',
   'TV', 'FINISHED', 'SUMMER', 2016, 12, '{Action,Comedy,Supernatural}',     85),
  (154587, 'Sousou no Frieren',      'Frieren: Beyond Journey''s End',
   'TV', 'FINISHED', 'FALL',   2023, 28, '{Adventure,Drama,Fantasy}',        91)
on conflict (anilist_id) do nothing;
