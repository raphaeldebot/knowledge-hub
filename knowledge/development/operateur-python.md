---
title: "Operateur python"
topic: "development"
level: "beginner"
tags: ["operateur", "python", "operator", "standard", "operators"]
source_type: "web_saved"
source_id: "https://docs.python.org/3/library/operator.html"
confidence: "medium"
status: "draft"
updated: "2026-06-19"
---

# Operateur python

The `operator` module in Python provides a set of functions that correspond to the standard operators in Python syntax. These functions allow you to perform operations such as addition, subtraction, multiplication, and more in a functional programming style.

### Mapping Operators to Functions

Here is a table showing how abstract operations correspond to operator symbols in Python syntax and the functions in the `operator` module:

| Operation             | Syntax       | Function         |
|-----------------------|--------------|------------------|
| Addition              | `a + b`      | `add(a, b)`      |
| Concatenation         | `seq1 + seq2`| `concat(seq1, seq2)` |
| Containment Test      | `obj in seq` | `contains(seq, obj)` |
| Division              | `a / b`      | `truediv(a, b)`  |
| Division              | `a // b`     | `floordiv(a, b)` |
| Bitwise And, or       | `a & b`      | `and_(a, b)`     |
| Bitwise Exclusive Or, or Symmetric Difference | `a ^ b` | `xor(a, b)` |
| Bitwise Inversion, or Complement | `~a` | `invert(a)` |
| Bitwise Or, or Union  | `a | b`      | `or_(a, b)`      |
| Exponentiation        | `a ** b`     | `pow(a, b)`      |
| Identity              | `a is b`     | `is_(a, b)`      |
| Identity              | `a is not b` | `is_not(a, b)` |
| Identity              | `a is None`  | `is_none(a)`     |
| Identity              | `a is not None` | `is_not_none(a)` |
| Indexed Assignment    | `obj[k] = v` | `setitem(obj, k, v)` |
| Indexed Deletion      | `del obj[k]` | `delitem(obj, k)` |
| Indexing              | `obj[k]`     | `getitem(obj, k)` |
| Left Shift            | `a << b`     | `lshift(a, b)`   |
| Modulo                | `a % b`      | `mod(a, b)`      |
| Multiplication        | `a * b`      | `mul(a, b)`      |
| Matrix Multiplication | `a @ b`      | `matmul(a, b)`   |
| Negation (Arithmetic) | `-a`         | `neg(a)`         |
| Negation (Logical)    | `not a`      | `not_(a)`        |
| Positive              | `+a`         | `pos(a)`         |
| Right Shift           | `a >> b`     | `rshift(a, b)`   |
| Slice Assignment      | `seq[i:j] = values` | `setitem(seq, slice(i, j), values)` |
| Slice Deletion        | `del seq[i:j]` | `delitem(seq, slice(i, j))` |
| Slicing               | `seq[i:j]`   | `getitem(seq, slice(i, j))` |
| String Formatting     | `s % obj`    | `mod(s, obj)`    |
| Subtraction           | `a - b`      | `sub(a, b)`      |
| Truth Test            | `obj`        | `truth(obj)`     |
| Ordering              | `a < b`      | `lt(a, b)`       |
| Ordering              | `a <= b`     | `le(a, b)`       |
| Equality              | `a == b`     | `eq(a, b)`       |
| Difference            | `a != b`     | `ne(a, b)`       |
| Ordering              | `a >= b`     | `ge(a, b)`       |
| Ordering              | `a > b`      | `gt(a, b)`       |

### In-place Operators

In-place operators perform operations that modify the object in place. Here are some examples:

| In-place Operation | Syntax       | Function         |
|--------------------|--------------|------------------|
| In-place Addition  | `a += b`     | `iadd(a, b)`     |
| In-place Bitwise And | `a &= b`   | `iand(a, b)`     |
| In-place Concatenation | `a += b` | `iconcat(a, b)` |
| In-place Floor Division | `a //= b` | `ifloordiv(a, b)` |
| In-place Left Shift | `a <<= b` | `ilshift(a, b)` |
| In-place Modulo    | `a %= b`     | `imod(a, b)`     |
| In-place Multiplication | `a *= b` | `imul(a, b)` |
| In-place Matrix Multiplication | `a @= b` | `imatmul(a, b)` |
| In-place Bitwise Or | `a |= b` | `ior(a, b)` |
| In-place Exponentiation | `a **= b` | `ipow(a, b)` |
| In-place Right Shift | `a >>= b` | `irshift(a, b)` |
| In-place Subtraction | `a -= b` | `isub(a, b)` |
| In-place True Division | `a /= b` | `itruediv(a, b)` |
| In-place Bitwise XOR | `a ^= b` | `ixor(a, b)` |

These functions are useful in functional programming and when working with higher-order functions that require passing operations as arguments.

## Source

- [operator — Standard operators as functions — Python 3.14.6 documentation](https://docs.python.org/3/library/operator.html)
