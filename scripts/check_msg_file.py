#!/usr/bin/env python3
"""commit-msg hook: pre-commit passes the path of the message file."""
import sys
from guard import check_message

err = check_message(open(sys.argv[1]).read())
if err:
    sys.exit(err)
