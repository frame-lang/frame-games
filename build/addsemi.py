import sys, re
# Append ';' to native statement lines that lack one, for brace-family targets.
# A native statement: indented, contains an assignment (' = ') OR is a bare
# child/self call ending in ')', and is NOT a Frame splice (@@:(...), -> , push$,
# pop$), NOT a control-flow header (ends with '{'), NOT a decl with ': type ='
# at state top, NOT already terminated.
out = []
for ln in sys.stdin.read().split("\n"):
    s = ln.rstrip("\n")
    st = s.strip()
    add = False
    if st and not st.endswith((";", "{", "}", ",")) \
       and "@@:(" not in st and not st.startswith("->") and "-> $" not in st \
       and "push$" not in st and "pop$" not in st and not st.startswith("//"):
        # assignment statement (but not a typed declaration 'name: T = v')
        if " = " in st and not re.match(r"^\$?\.?[A-Za-z_][A-Za-z0-9_]*\s*:\s*\w", st) \
           and not re.match(r"^[A-Za-z_][A-Za-z0-9_]*\s*:\s*\w+\s*=", st):
            add = True
        # bare child/self call:  @@:self.x.y(...)   or   $this->... already has ;
        elif re.match(r"^@@:self\.[A-Za-z_].*\)$", st):
            add = True
    out.append(s + ";" if add else s)
sys.stdout.write("\n".join(out))
