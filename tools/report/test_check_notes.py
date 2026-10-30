"""The checker lists each note that breaks the citation norm, and it exits non-zero on a break."""
import check_notes as c

GOOD = ("Un fait.[^I-1]\n\n"
        "[^I-1]: Trésor américain (OFAC), « Treasury Sanctions Entities », communiqué jy1795, "
        "12 octobre 2023, p. 2 ; FCDO, *UK Sanctions List*, version du 16 octobre 2026.\n")


def rules(text, final=False):
    return [(f.label, f.rule) for f in c.check({"a.md": text}, final=final)]


def note(body, label="I-1"):
    return f"Texte.[^{label}]\n\n[^{label}]: {body}\n"


def test_a_clean_note_has_no_fault():
    assert rules(GOOD) == []


def test_a_call_without_a_note_and_a_note_without_a_call():
    assert ("I-2", "no-note") in rules("Texte.[^I-2]\n")
    assert ("I-3", "unused-note") in rules("[^I-3]: Source, « T », 1er mai 2026.\n")


def test_a_note_with_no_source():
    assert ("I-1", "no-source") in rules(note("[SOURCE ?]"))
    assert ("I-1", "no-source") in rules(note(""))


def test_more_than_two_sources():
    body = "A, « a », 1er mai 2026 ; B, « b », 2 mai 2026 ; C, « c », 3 mai 2026."
    assert ("I-1", "sources") in rules(note(body))


def test_semicolons_in_quotes_parentheses_and_the_comment_do_not_count():
    body = ("A, « a ; b », 1er mai 2026 (calcul ; méthode) ; B, « b », 2 mai 2026. "
            "Le texte explique un point ; puis un autre ; puis un dernier.")
    assert rules(note(body)) == []


def test_an_internal_id_a_file_name_or_an_archive_word():
    uid = "3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f"
    assert ("I-1", "internal") in rules(note(f"A, « a », 1er mai 2026, document {uid}."))
    assert ("I-1", "internal") in rules(note("A, « a », 1er mai 2026, feuille de data.xlsx."))
    assert ("I-1", "internal") in rules(note("A, « a », 1er mai 2026, page non archivée."))


def test_a_relative_note():
    assert ("I-1", "relative") in rules(note("Idem, 1er mai 2026."))
    assert ("I-1", "relative") in rules(note("Même cas pour SMP, 1er mai 2026."))


def test_a_date_that_is_not_full():
    assert ("I-1", "date") in rules(note("The Moscow Times, « Titre », mai 2026."))
    assert ("I-1", "date") in rules(note("Média, « Titre », début novembre 2024."))
    assert ("I-1", "date") in rules(note("Média, « Titre », 2026."))


def test_a_no_break_space_is_a_space():
    assert rules(note("Média, « Titre », 12 octobre 2026.")) == []


def test_a_full_date_an_act_and_a_report_month_pass():
    assert rules(note("Média, « Titre », 1er mai 2026.")) == []
    assert rules(note("Règlement (UE) 2022/879 du Conseil du 3 juin 2022, art. 3 m.")) == []
    assert rules(note("KSE Institute, *Russian Oil Tracker*, février 2026, p. 3.")) == []


def test_version_dates_of_one_list_must_agree():
    a = "Trésor américain (OFAC), *Specially Designated Nationals List*, version du 21 octobre 2026."
    b = a.replace("21", "22")
    text = note(a, "I-1") + note(a, "I-2") + note(b, "I-3")
    got = rules(text)
    assert ("I-3", "version") in got and ("I-1", "version") not in got


def test_open_markers_are_counted_and_fail_only_in_the_final_text():
    text = GOOD + "Autre fait [SOURCE ?].\n"
    assert c.count_markers(text) == {"[SOURCE ?]": 1, "[année ?]": 0}
    assert ("-", "open-marker") not in rules(text)
    assert ("-", "open-marker") in rules(text, final=True)


def test_the_command_line_exits_non_zero_on_a_fault(tmp_path, capsys):
    good, bad = tmp_path / "good.md", tmp_path / "bad.md"
    good.write_text(GOOD, encoding="utf-8")
    bad.write_text(note("Idem."), encoding="utf-8")
    assert c.main([str(good)]) == 0
    assert c.main([str(good), str(bad)]) == 1
    out = capsys.readouterr().out
    assert "bad.md" in out and "I-1" in out and "relative" in out
