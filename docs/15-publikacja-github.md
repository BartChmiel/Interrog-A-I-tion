# Publikacja na GitHub

## Cel

Pierwsza publikacja repozytorium ma zapisac aktualny fundament projektu:

- dokumentacje,
- strukture katalogow,
- pierwsze modele domenowe,
- guardrails,
- schematy danych,
- testy.

Repozytorium powinno byc na start prywatne, dopoki temat, promotor i ewentualne dane badawcze nie sa formalnie poukladane.

## Przed pushem

Sprawdzamy:

1. Czy w repo nie ma danych wrazliwych.
2. Czy `.gitignore` obejmuje dane prywatne, bazy, eksporty i sekrety.
3. Czy testy przechodza.
4. Czy README opisuje ograniczenie: system nie wykrywa klamstwa.
5. Czy repo nie zawiera kluczy, tokenow ani materialow rzeczywistych.

## Komendy lokalne

Z katalogu projektu:

```powershell
git init -b main
git status
git add .
git commit -m "Initial project structure"
```

Potem tworzymy puste repo na GitHubie. Najbezpieczniej:

- bez README,
- bez `.gitignore`,
- bez license na stronie GitHub, bo te pliki juz mamy lokalnie albo dodamy je swiadomie pozniej.

Po utworzeniu repo GitHub poda adres, np.:

```text
https://github.com/TWOJ-LOGIN/interigaition.git
```

Wtedy:

```powershell
git remote add origin https://github.com/TWOJ-LOGIN/interigaition.git
git remote -v
git push -u origin main
```

## Wariant z GitHub CLI

Jesli `gh` jest zalogowane:

```powershell
git init -b main
git add .
git commit -m "Initial project structure"
gh repo create interigaition --private --source=. --remote=origin --push
```

## Co moge zrobic automatycznie

Moge przygotowac lokalny commit i push przez GitHub, ale potrzebuje:

- nazwy repozytorium,
- decyzji: prywatne czy publiczne,
- informacji, czy repo ma byc na Twoim koncie czy w organizacji.

Na ten moment rekomendacja: repo prywatne, nazwa `interigaition` albo `interig-ai-tion`.

