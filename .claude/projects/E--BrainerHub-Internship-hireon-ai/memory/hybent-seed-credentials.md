--- 
name: hybent-seed-credentials
description: demo logins for the local app, and the stale line in seed.py that lies about the super admin
metadata:
  type: user

The seed.py script creates demo users with the password "password123". The script also contains a line that incorrectly states that the user with email "yashdesai494@hybent.com" is a super admin, when in fact they are not. This is a bug in the script that should be fixed.