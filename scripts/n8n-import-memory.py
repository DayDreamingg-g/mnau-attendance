"""Pass the machine credential through an anonymous memory file, never a disk JSON file."""
import json,os,subprocess,sys
payload=[{'id':'attendance-machine-test','name':'Attendance machine verification','type':'httpHeaderAuth','data':{'name':'Authorization','value':'Bearer '+os.environ['REPORT_MACHINE_TOKEN']}}]
fd=os.memfd_create('n8n-credential-import',0)
try:
    os.write(fd,json.dumps(payload).encode())
    os.lseek(fd,0,os.SEEK_SET)
    result=subprocess.run([os.environ['N8N_NODE_BIN'],os.environ['N8N_TEST_BIN'],'import:credentials','--input=/proc/self/fd/'+str(fd)],pass_fds=(fd,))
    sys.exit(result.returncode)
finally:
    os.close(fd)
