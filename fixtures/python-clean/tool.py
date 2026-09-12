import subprocess

def status():
    return subprocess.run(["git", "status"], check=True)
