// The lowest layer of the models: scans over a list or a text, each proved once for any test.
// Every model (Marketplace, WorkData, WorkPane) and every link reuses these instead of proving a
// scan of its own (wiki Proofs, "General before specific"). Text is UTF-16 code units, as in
// JavaScript (lemmascript.json "javascript-utf16").

module Text {

  // ---------------------------------------------------------------- lists
  // Where the run of elements passing `ok` that starts at `i` ends: the first index from `i`
  // whose element fails `ok`, or the end. A search for x is the run of elements that are not x.

  function ListEnd<T>(xs: seq<T>, i: nat, ok: T -> bool): nat
    requires i <= |xs|
    ensures i <= ListEnd(xs, i, ok) <= |xs|
    ensures forall k :: i <= k < ListEnd(xs, i, ok) ==> ok(xs[k])
    ensures ListEnd(xs, i, ok) == |xs| || !ok(xs[ListEnd(xs, i, ok)])
    decreases |xs| - i
  {
    if i == |xs| || !ok(xs[i]) then i else ListEnd(xs, i + 1, ok)
  }

  // Those two properties pin the result: the run ends at j when every element from i to j passes
  // and j is the end or fails.
  lemma ListEndIs<T>(xs: seq<T>, i: nat, j: nat, ok: T -> bool)
    requires i <= j <= |xs|
    requires forall k :: i <= k < j ==> ok(xs[k])
    requires j == |xs| || !ok(xs[j])
    ensures ListEnd(xs, i, ok) == j
    decreases j - i
  {
    if i < j { ListEndIs(xs, i + 1, j, ok); }
  }

  // The run reaches j exactly when every element from i to j passes; j = |xs| is "all pass", and
  // "some element fails" is the run stopping short of the end.
  lemma ListReaches<T>(xs: seq<T>, i: nat, j: nat, ok: T -> bool)
    requires i <= j <= |xs|
    ensures ListEnd(xs, i, ok) >= j <==> forall k :: i <= k < j ==> ok(xs[k])
  {
  }

  // Two lists of one length whose tests agree at every index from i give the same run. It covers
  // code passing its own test (one list, two tests) and code records linked to model records
  // (a list and its mapped image).
  lemma ListEndAgree<A, B>(xs: seq<A>, ys: seq<B>, i: nat, ok: A -> bool, ok2: B -> bool)
    requires i <= |xs| == |ys|
    requires forall k :: i <= k < |xs| ==> ok(xs[k]) == ok2(ys[k])
    ensures ListEnd(xs, i, ok) == ListEnd(ys, i, ok2)
    decreases |xs| - i
  {
    if i < |xs| { ListEndAgree(xs, ys, i + 1, ok, ok2); }
  }

  // The same, for every pair of tests at once: a link uses it when the code passes a lambda of its
  // own, which is a different function value from the model's with the same body.
  lemma ListEndExt<A, B>(xs: seq<A>, ys: seq<B>, i: nat)
    requires i <= |xs| == |ys|
    ensures forall ok: A -> bool, ok2: B -> bool {:trigger ListEnd(xs, i, ok), ListEnd(ys, i, ok2)} ::
      (forall k :: i <= k < |xs| ==> ok(xs[k]) == ok2(ys[k])) ==> ListEnd(xs, i, ok) == ListEnd(ys, i, ok2)
  {
    forall ok: A -> bool, ok2: B -> bool | (forall k :: i <= k < |xs| ==> ok(xs[k]) == ok2(ys[k]))
      ensures ListEnd(xs, i, ok) == ListEnd(ys, i, ok2)
    {
      ListEndAgree(xs, ys, i, ok, ok2);
    }
  }

  // ---------------------------------------------------------------- text, forward
  // A scan over text is the list scan over its code units, with the test on the unit's number.

  function ScanEnd(s: string, i: nat, ok: int -> bool): nat
    requires i <= |s|
    ensures i <= ScanEnd(s, i, ok) <= |s|
    ensures forall k :: i <= k < ScanEnd(s, i, ok) ==> ok(s[k] as int)
    ensures ScanEnd(s, i, ok) == |s| || !ok(s[ScanEnd(s, i, ok)] as int)
  {
    ListEnd(s, i, (c: char) => ok(c as int))
  }

  lemma ScanEndIs(s: string, i: nat, j: nat, ok: int -> bool)
    requires i <= j <= |s|
    requires forall k :: i <= k < j ==> ok(s[k] as int)
    requires j == |s| || !ok(s[j] as int)
    ensures ScanEnd(s, i, ok) == j
  {
    ListEndIs(s, i, j, (c: char) => ok(c as int));
  }

  lemma ScanReaches(s: string, i: nat, j: nat, ok: int -> bool)
    requires i <= j <= |s|
    ensures ScanEnd(s, i, ok) >= j <==> forall k :: i <= k < j ==> ok(s[k] as int)
  {
  }

  lemma ScanEndAgree(s: string, i: nat, ok: int -> bool, ok2: int -> bool)
    requires i <= |s|
    requires forall c :: ok(c) == ok2(c)
    ensures ScanEnd(s, i, ok) == ScanEnd(s, i, ok2)
  {
    ListEndAgree(s, s, i, (c: char) => ok(c as int), (c: char) => ok2(c as int));
  }

  lemma ScanEndExt(s: string, i: nat)
    requires i <= |s|
    ensures forall ok: int -> bool, ok2: int -> bool {:trigger ScanEnd(s, i, ok), ScanEnd(s, i, ok2)} ::
      (forall c :: ok(c) == ok2(c)) ==> ScanEnd(s, i, ok) == ScanEnd(s, i, ok2)
  {
    forall ok: int -> bool, ok2: int -> bool | (forall c :: ok(c) == ok2(c))
      ensures ScanEnd(s, i, ok) == ScanEnd(s, i, ok2)
    {
      ScanEndAgree(s, i, ok, ok2);
    }
  }

  // All of s from i passes exactly when all of the slice s[i..] does: the model's "every
  // character" predicates read slices.
  lemma ScanAllSlice(s: string, i: nat, ok: int -> bool)
    requires i <= |s|
    ensures ScanEnd(s, i, ok) == |s| <==> forall k :: 0 <= k < |s| - i ==> ok(s[i..][k] as int)
  {
    ScanReaches(s, i, |s|, ok);
    var t := s[i..];
    if forall k :: 0 <= k < |t| ==> ok(t[k] as int) {
      forall k | i <= k < |s| ensures ok(s[k] as int) { assert s[k] == t[k - i]; }
    }
  }

  // ---------------------------------------------------------------- text, backward
  // Where the run of code units passing `ok` that ends at `e` starts, no lower than `lo`.

  function RunStart(s: string, lo: nat, e: nat, ok: int -> bool): nat
    requires lo <= e <= |s|
    ensures lo <= RunStart(s, lo, e, ok) <= e
    ensures forall k :: RunStart(s, lo, e, ok) <= k < e ==> ok(s[k] as int)
    ensures RunStart(s, lo, e, ok) == lo || !ok(s[RunStart(s, lo, e, ok) - 1] as int)
    decreases e - lo
  {
    if e == lo || !ok(s[e - 1] as int) then e else RunStart(s, lo, e - 1, ok)
  }

  lemma RunStartIs(s: string, lo: nat, j: nat, e: nat, ok: int -> bool)
    requires lo <= j <= e <= |s|
    requires forall k :: j <= k < e ==> ok(s[k] as int)
    requires j == lo || !ok(s[j - 1] as int)
    ensures RunStart(s, lo, e, ok) == j
    decreases e - j
  {
    if j < e { RunStartIs(s, lo, j, e - 1, ok); }
  }

  lemma RunStartAgree(s: string, lo: nat, e: nat, ok: int -> bool, ok2: int -> bool)
    requires lo <= e <= |s|
    requires forall c :: ok(c) == ok2(c)
    ensures RunStart(s, lo, e, ok) == RunStart(s, lo, e, ok2)
    decreases e - lo
  {
    if lo < e { RunStartAgree(s, lo, e - 1, ok, ok2); }
  }

  lemma RunStartExt(s: string, lo: nat, e: nat)
    requires lo <= e <= |s|
    ensures forall ok: int -> bool, ok2: int -> bool {:trigger RunStart(s, lo, e, ok), RunStart(s, lo, e, ok2)} ::
      (forall c :: ok(c) == ok2(c)) ==> RunStart(s, lo, e, ok) == RunStart(s, lo, e, ok2)
  {
    forall ok: int -> bool, ok2: int -> bool | (forall c :: ok(c) == ok2(c))
      ensures RunStart(s, lo, e, ok) == RunStart(s, lo, e, ok2)
    {
      RunStartAgree(s, lo, e, ok, ok2);
    }
  }
}
