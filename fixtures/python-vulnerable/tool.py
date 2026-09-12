import subprocess

def run(command):
    return subprocess.run(command, shell=True, check=True)
