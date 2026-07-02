"use strict";(()=>{var K=class c{static read_bytes(e,n){let s=new c;return s.buf=e.getUint32(n,!0),s.buf_len=e.getUint32(n+4,!0),s}static read_bytes_array(e,n,s){let i=[];for(let t=0;t<s;t++)i.push(c.read_bytes(e,n+8*t));return i}},q=class c{static read_bytes(e,n){let s=new c;return s.buf=e.getUint32(n,!0),s.buf_len=e.getUint32(n+4,!0),s}static read_bytes_array(e,n,s){let i=[];for(let t=0;t<s;t++)i.push(c.read_bytes(e,n+8*t));return i}},pe=0,me=1,re=2;var y=3,V=4;var H=class{head_length(){return 24}name_length(){return this.dir_name.byteLength}write_head_bytes(e,n){e.setBigUint64(n,this.d_next,!0),e.setBigUint64(n+8,this.d_ino,!0),e.setUint32(n+16,this.dir_name.length,!0),e.setUint8(n+20,this.d_type)}write_name_bytes(e,n,s){e.set(this.dir_name.slice(0,Math.min(this.dir_name.byteLength,s)),n)}constructor(e,n,s){this.d_ino=0n;let i=new TextEncoder().encode(n);this.d_next=e,this.d_namlen=i.byteLength,this.d_type=s,this.dir_name=i}};var he=1;var j=class{write_bytes(e,n){e.setUint8(n,this.fs_filetype),e.setUint16(n+2,this.fs_flags,!0),e.setBigUint64(n+8,this.fs_rights_base,!0),e.setBigUint64(n+16,this.fs_rights_inherited,!0)}constructor(e,n){this.fs_rights_base=0n,this.fs_rights_inherited=0n,this.fs_filetype=e,this.fs_flags=n}};var se=1,z=2,ge=4,_e=8,B=class{write_bytes(e,n){e.setBigUint64(n,this.dev,!0),e.setBigUint64(n+8,this.ino,!0),e.setUint8(n+16,this.filetype),e.setBigUint64(n+24,this.nlink,!0),e.setBigUint64(n+32,this.size,!0),e.setBigUint64(n+38,this.atim,!0),e.setBigUint64(n+46,this.mtim,!0),e.setBigUint64(n+52,this.ctim,!0)}constructor(e,n){this.dev=0n,this.ino=0n,this.nlink=0n,this.atim=0n,this.mtim=0n,this.ctim=0n,this.filetype=e,this.size=n}};var We=0,fe=class{write_bytes(e,n){e.setUint32(n,this.pr_name.byteLength,!0)}constructor(e){this.pr_name=new TextEncoder().encode(e)}},ne=class c{static dir(e){let n=new c;return n.tag=We,n.inner=new fe(e),n}write_bytes(e,n){e.setUint32(n,this.tag,!0),this.inner.write_bytes(e,n+4)}};var Ye=class{enable(e){this.log=$e(e===void 0?!0:e,this.prefix)}get enabled(){return this.isEnabled}constructor(e){this.isEnabled=e,this.prefix="wasi:",this.enable(e)}};function $e(c,e){return c?console.log.bind(console,"%c%s","color: #265BA0",e):()=>{}}var E=new Ye(!1);var Z=class extends Error{constructor(e){super("exit with exit code "+e),this.code=e}},xe=class{start(e){this.inst=e;try{return e.exports._start(),0}catch(n){if(n instanceof Z)return n.code;throw n}}initialize(e){this.inst=e,e.exports._initialize&&e.exports._initialize()}constructor(e,n,s,i={}){this.args=[],this.env=[],this.fds=[],E.enable(i.debug),this.args=e,this.env=n,this.fds=s;let t=this;this.wasiImport={args_sizes_get(r,_){let a=new DataView(t.inst.exports.memory.buffer);a.setUint32(r,t.args.length,!0);let o=0;for(let l of t.args)o+=l.length+1;return a.setUint32(_,o,!0),E.log(a.getUint32(r,!0),a.getUint32(_,!0)),0},args_get(r,_){let a=new DataView(t.inst.exports.memory.buffer),o=new Uint8Array(t.inst.exports.memory.buffer),l=_;for(let d=0;d<t.args.length;d++){a.setUint32(r,_,!0),r+=4;let u=new TextEncoder().encode(t.args[d]);o.set(u,_),a.setUint8(_+u.length,0),_+=u.length+1}return E.enabled&&E.log(new TextDecoder("utf-8").decode(o.slice(l,_))),0},environ_sizes_get(r,_){let a=new DataView(t.inst.exports.memory.buffer);a.setUint32(r,t.env.length,!0);let o=0;for(let l of t.env)o+=l.length+1;return a.setUint32(_,o,!0),E.log(a.getUint32(r,!0),a.getUint32(_,!0)),0},environ_get(r,_){let a=new DataView(t.inst.exports.memory.buffer),o=new Uint8Array(t.inst.exports.memory.buffer),l=_;for(let d=0;d<t.env.length;d++){a.setUint32(r,_,!0),r+=4;let u=new TextEncoder().encode(t.env[d]);o.set(u,_),a.setUint8(_+u.length,0),_+=u.length+1}return E.enabled&&E.log(new TextDecoder("utf-8").decode(o.slice(l,_))),0},clock_res_get(r,_){let a;switch(r){case 1:{a=5000n;break}case 0:{a=1000000n;break}default:return 52}return new DataView(t.inst.exports.memory.buffer).setBigUint64(_,a,!0),0},clock_time_get(r,_,a){let o=new DataView(t.inst.exports.memory.buffer);if(r===0)o.setBigUint64(a,BigInt(new Date().getTime())*1000000n,!0);else if(r==1){let l;try{l=BigInt(Math.round(performance.now()*1e6))}catch{l=0n}o.setBigUint64(a,l,!0)}else o.setBigUint64(a,0n,!0);return 0},fd_advise(r,_,a,o){return t.fds[r]!=null?0:8},fd_allocate(r,_,a){return t.fds[r]!=null?t.fds[r].fd_allocate(_,a):8},fd_close(r){if(t.fds[r]!=null){let _=t.fds[r].fd_close();return t.fds[r]=void 0,_}else return 8},fd_datasync(r){return t.fds[r]!=null?t.fds[r].fd_sync():8},fd_fdstat_get(r,_){if(t.fds[r]!=null){let{ret:a,fdstat:o}=t.fds[r].fd_fdstat_get();return o?.write_bytes(new DataView(t.inst.exports.memory.buffer),_),a}else return 8},fd_fdstat_set_flags(r,_){return t.fds[r]!=null?t.fds[r].fd_fdstat_set_flags(_):8},fd_fdstat_set_rights(r,_,a){return t.fds[r]!=null?t.fds[r].fd_fdstat_set_rights(_,a):8},fd_filestat_get(r,_){if(t.fds[r]!=null){let{ret:a,filestat:o}=t.fds[r].fd_filestat_get();return o?.write_bytes(new DataView(t.inst.exports.memory.buffer),_),a}else return 8},fd_filestat_set_size(r,_){return t.fds[r]!=null?t.fds[r].fd_filestat_set_size(_):8},fd_filestat_set_times(r,_,a,o){return t.fds[r]!=null?t.fds[r].fd_filestat_set_times(_,a,o):8},fd_pread(r,_,a,o,l){let d=new DataView(t.inst.exports.memory.buffer),u=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let f=K.read_bytes_array(d,_,a),m=0;for(let p of f){let{ret:x,data:R}=t.fds[r].fd_pread(p.buf_len,o);if(x!=0)return d.setUint32(l,m,!0),x;if(u.set(R,p.buf),m+=R.length,o+=BigInt(R.length),R.length!=p.buf_len)break}return d.setUint32(l,m,!0),0}else return 8},fd_prestat_get(r,_){let a=new DataView(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let{ret:o,prestat:l}=t.fds[r].fd_prestat_get();return l?.write_bytes(a,_),o}else return 8},fd_prestat_dir_name(r,_,a){if(t.fds[r]!=null){let{ret:o,prestat:l}=t.fds[r].fd_prestat_get();if(l==null)return o;let d=l.inner.pr_name;return new Uint8Array(t.inst.exports.memory.buffer).set(d.slice(0,a),_),d.byteLength>a?37:0}else return 8},fd_pwrite(r,_,a,o,l){let d=new DataView(t.inst.exports.memory.buffer),u=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let f=q.read_bytes_array(d,_,a),m=0;for(let p of f){let x=u.slice(p.buf,p.buf+p.buf_len),{ret:R,nwritten:A}=t.fds[r].fd_pwrite(x,o);if(R!=0)return d.setUint32(l,m,!0),R;if(m+=A,o+=BigInt(A),A!=x.byteLength)break}return d.setUint32(l,m,!0),0}else return 8},fd_read(r,_,a,o){let l=new DataView(t.inst.exports.memory.buffer),d=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let u=K.read_bytes_array(l,_,a),f=0;for(let m of u){let{ret:p,data:x}=t.fds[r].fd_read(m.buf_len);if(p!=0)return l.setUint32(o,f,!0),p;if(d.set(x,m.buf),f+=x.length,x.length!=m.buf_len)break}return l.setUint32(o,f,!0),0}else return 8},fd_readdir(r,_,a,o,l){let d=new DataView(t.inst.exports.memory.buffer),u=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let f=0;for(;;){let{ret:m,dirent:p}=t.fds[r].fd_readdir_single(o);if(m!=0)return d.setUint32(l,f,!0),m;if(p==null)break;if(a-f<p.head_length()){f=a;break}let x=new ArrayBuffer(p.head_length());if(p.write_head_bytes(new DataView(x),0),u.set(new Uint8Array(x).slice(0,Math.min(x.byteLength,a-f)),_),_+=p.head_length(),f+=p.head_length(),a-f<p.name_length()){f=a;break}p.write_name_bytes(u,_,a-f),_+=p.name_length(),f+=p.name_length(),o=p.d_next}return d.setUint32(l,f,!0),0}else return 8},fd_renumber(r,_){if(t.fds[r]!=null&&t.fds[_]!=null){let a=t.fds[_].fd_close();return a!=0?a:(t.fds[_]=t.fds[r],t.fds[r]=void 0,0)}else return 8},fd_seek(r,_,a,o){let l=new DataView(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let{ret:d,offset:u}=t.fds[r].fd_seek(_,a);return l.setBigInt64(o,u,!0),d}else return 8},fd_sync(r){return t.fds[r]!=null?t.fds[r].fd_sync():8},fd_tell(r,_){let a=new DataView(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let{ret:o,offset:l}=t.fds[r].fd_tell();return a.setBigUint64(_,l,!0),o}else return 8},fd_write(r,_,a,o){let l=new DataView(t.inst.exports.memory.buffer),d=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let u=q.read_bytes_array(l,_,a),f=0;for(let m of u){let p=d.slice(m.buf,m.buf+m.buf_len),{ret:x,nwritten:R}=t.fds[r].fd_write(p);if(x!=0)return l.setUint32(o,f,!0),x;if(f+=R,R!=p.byteLength)break}return l.setUint32(o,f,!0),0}else return 8},path_create_directory(r,_,a){let o=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let l=new TextDecoder("utf-8").decode(o.slice(_,_+a));return t.fds[r].path_create_directory(l)}else return 8},path_filestat_get(r,_,a,o,l){let d=new DataView(t.inst.exports.memory.buffer),u=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let f=new TextDecoder("utf-8").decode(u.slice(a,a+o)),{ret:m,filestat:p}=t.fds[r].path_filestat_get(_,f);return p?.write_bytes(d,l),m}else return 8},path_filestat_set_times(r,_,a,o,l,d,u){let f=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let m=new TextDecoder("utf-8").decode(f.slice(a,a+o));return t.fds[r].path_filestat_set_times(_,m,l,d,u)}else return 8},path_link(r,_,a,o,l,d,u){let f=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null&&t.fds[l]!=null){let m=new TextDecoder("utf-8").decode(f.slice(a,a+o)),p=new TextDecoder("utf-8").decode(f.slice(d,d+u)),{ret:x,inode_obj:R}=t.fds[r].path_lookup(m,_);return R==null?x:t.fds[l].path_link(p,R,!1)}else return 8},path_open(r,_,a,o,l,d,u,f,m){let p=new DataView(t.inst.exports.memory.buffer),x=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let R=new TextDecoder("utf-8").decode(x.slice(a,a+o));E.log(R);let{ret:A,fd_obj:ve}=t.fds[r].path_open(_,R,l,d,u,f);if(A!=0)return A;t.fds.push(ve);let J=t.fds.length-1;return p.setUint32(m,J,!0),0}else return 8},path_readlink(r,_,a,o,l,d){let u=new DataView(t.inst.exports.memory.buffer),f=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let m=new TextDecoder("utf-8").decode(f.slice(_,_+a));E.log(m);let{ret:p,data:x}=t.fds[r].path_readlink(m);if(x!=null){let R=new TextEncoder().encode(x);if(R.length>l)return u.setUint32(d,0,!0),8;f.set(R,o),u.setUint32(d,R.length,!0)}return p}else return 8},path_remove_directory(r,_,a){let o=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let l=new TextDecoder("utf-8").decode(o.slice(_,_+a));return t.fds[r].path_remove_directory(l)}else return 8},path_rename(r,_,a,o,l,d){let u=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null&&t.fds[o]!=null){let f=new TextDecoder("utf-8").decode(u.slice(_,_+a)),m=new TextDecoder("utf-8").decode(u.slice(l,l+d)),{ret:p,inode_obj:x}=t.fds[r].path_unlink(f);if(x==null)return p;if(p=t.fds[o].path_link(m,x,!0),p!=0&&t.fds[r].path_link(f,x,!0)!=0)throw"path_link should always return success when relinking an inode back to the original place";return p}else return 8},path_symlink(r,_,a,o,l){let d=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[a]!=null){let u=new TextDecoder("utf-8").decode(d.slice(r,r+_)),f=new TextDecoder("utf-8").decode(d.slice(o,o+l));return 58}else return 8},path_unlink_file(r,_,a){let o=new Uint8Array(t.inst.exports.memory.buffer);if(t.fds[r]!=null){let l=new TextDecoder("utf-8").decode(o.slice(_,_+a));return t.fds[r].path_unlink_file(l)}else return 8},poll_oneoff(r,_,a){throw"async io not supported"},proc_exit(r){throw new Z(r)},proc_raise(r){throw"raised signal "+r},sched_yield(){},random_get(r,_){let a=new Uint8Array(t.inst.exports.memory.buffer);for(let o=0;o<_;o++)a[r+o]=Math.random()*256|0},sock_recv(r,_,a){throw"sockets not supported"},sock_send(r,_,a){throw"sockets not supported"},sock_shutdown(r,_){throw"sockets not supported"},sock_accept(r,_){throw"sockets not supported"}}}};var U=class{fd_allocate(e,n){return 58}fd_close(){return 0}fd_fdstat_get(){return{ret:58,fdstat:null}}fd_fdstat_set_flags(e){return 58}fd_fdstat_set_rights(e,n){return 58}fd_filestat_get(){return{ret:58,filestat:null}}fd_filestat_set_size(e){return 58}fd_filestat_set_times(e,n,s){return 58}fd_pread(e,n){return{ret:58,data:new Uint8Array}}fd_prestat_get(){return{ret:58,prestat:null}}fd_pwrite(e,n){return{ret:58,nwritten:0}}fd_read(e){return{ret:58,data:new Uint8Array}}fd_readdir_single(e){return{ret:58,dirent:null}}fd_seek(e,n){return{ret:58,offset:0n}}fd_sync(){return 0}fd_tell(){return{ret:58,offset:0n}}fd_write(e){return{ret:58,nwritten:0}}path_create_directory(e){return 58}path_filestat_get(e,n){return{ret:58,filestat:null}}path_filestat_set_times(e,n,s,i,t){return 58}path_link(e,n,s){return 58}path_unlink(e){return{ret:58,inode_obj:null}}path_lookup(e,n){return{ret:58,inode_obj:null}}path_open(e,n,s,i,t,r){return{ret:54,fd_obj:null}}path_readlink(e){return{ret:58,data:null}}path_remove_directory(e){return 58}path_rename(e,n,s){return 58}path_unlink_file(e){return 58}},P=class{};var T=class extends U{fd_allocate(e,n){if(!(this.file.size>e+n)){let s=new Uint8Array(Number(e+n));s.set(this.file.data,0),this.file.data=s}return 0}fd_fdstat_get(){return{ret:0,fdstat:new j(V,0)}}fd_filestat_set_size(e){if(this.file.size>e)this.file.data=new Uint8Array(this.file.data.buffer.slice(0,Number(e)));else{let n=new Uint8Array(Number(e));n.set(this.file.data,0),this.file.data=n}return 0}fd_read(e){let n=this.file.data.slice(Number(this.file_pos),Number(this.file_pos+BigInt(e)));return this.file_pos+=BigInt(n.length),{ret:0,data:n}}fd_pread(e,n){return{ret:0,data:this.file.data.slice(Number(n),Number(n+BigInt(e)))}}fd_seek(e,n){let s;switch(n){case pe:s=e;break;case me:s=this.file_pos+e;break;case re:s=BigInt(this.file.data.byteLength)+e;break;default:return{ret:28,offset:0n}}return s<0?{ret:28,offset:0n}:(this.file_pos=s,{ret:0,offset:this.file_pos})}fd_tell(){return{ret:0,offset:this.file_pos}}fd_write(e){if(this.file.readonly)return{ret:8,nwritten:0};if(this.file_pos+BigInt(e.byteLength)>this.file.size){let n=this.file.data;this.file.data=new Uint8Array(Number(this.file_pos+BigInt(e.byteLength))),this.file.data.set(n)}return this.file.data.set(e,Number(this.file_pos)),this.file_pos+=BigInt(e.byteLength),{ret:0,nwritten:e.byteLength}}fd_pwrite(e,n){if(this.file.readonly)return{ret:8,nwritten:0};if(n+BigInt(e.byteLength)>this.file.size){let s=this.file.data;this.file.data=new Uint8Array(Number(n+BigInt(e.byteLength))),this.file.data.set(s)}return this.file.data.set(e,Number(n)),{ret:0,nwritten:e.byteLength}}fd_filestat_get(){return{ret:0,filestat:this.file.stat()}}constructor(e){super(),this.file_pos=0n,this.file=e}},ee=class extends U{fd_seek(e,n){return{ret:8,offset:0n}}fd_tell(){return{ret:8,offset:0n}}fd_allocate(e,n){return 8}fd_fdstat_get(){return{ret:0,fdstat:new j(y,0)}}fd_readdir_single(e){if(E.enabled&&(E.log("readdir_single",e),E.log(e,this.dir.contents.keys())),e==0n)return{ret:0,dirent:new H(1n,".",y)};if(e==1n)return{ret:0,dirent:new H(2n,"..",y)};if(e>=BigInt(this.dir.contents.size)+2n)return{ret:0,dirent:null};let[n,s]=Array.from(this.dir.contents.entries())[Number(e-2n)];return{ret:0,dirent:new H(e+1n,n,s.stat().filetype)}}path_filestat_get(e,n){let{ret:s,path:i}=I.from(n);if(i==null)return{ret:s,filestat:null};let{ret:t,entry:r}=this.dir.get_entry_for_path(i);return r==null?{ret:t,filestat:null}:{ret:0,filestat:r.stat()}}path_lookup(e,n){let{ret:s,path:i}=I.from(e);if(i==null)return{ret:s,inode_obj:null};let{ret:t,entry:r}=this.dir.get_entry_for_path(i);return r==null?{ret:t,inode_obj:null}:{ret:0,inode_obj:r}}path_open(e,n,s,i,t,r){let{ret:_,path:a}=I.from(n);if(a==null)return{ret:_,fd_obj:null};let{ret:o,entry:l}=this.dir.get_entry_for_path(a);if(l==null){if(o!=44)return{ret:o,fd_obj:null};if((s&se)==se){let{ret:d,entry:u}=this.dir.create_entry_for_path(n,(s&z)==z);if(u==null)return{ret:d,fd_obj:null};l=u}else return{ret:44,fd_obj:null}}else if((s&ge)==ge)return{ret:20,fd_obj:null};return(s&z)==z&&l.stat().filetype!==y?{ret:54,fd_obj:null}:l.path_open(s,i,r)}path_create_directory(e){return this.path_open(0,e,se|z,0n,0n,0).ret}path_link(e,n,s){let{ret:i,path:t}=I.from(e);if(t==null)return i;if(t.is_dir)return 44;let{ret:r,parent_entry:_,filename:a,entry:o}=this.dir.get_parent_dir_and_entry_for_path(t,!0);if(_==null||a==null)return r;if(o!=null){let l=n.stat().filetype==y,d=o.stat().filetype==y;if(l&&d)if(s&&o instanceof M){if(o.contents.size!=0)return 55}else return 20;else{if(l&&!d)return 54;if(!l&&d)return 31;if(!(n.stat().filetype==V&&o.stat().filetype==V))return 20}}return!s&&n.stat().filetype==y?63:(_.contents.set(a,n),0)}path_unlink(e){let{ret:n,path:s}=I.from(e);if(s==null)return{ret:n,inode_obj:null};let{ret:i,parent_entry:t,filename:r,entry:_}=this.dir.get_parent_dir_and_entry_for_path(s,!0);return t==null||r==null?{ret:i,inode_obj:null}:_==null?{ret:44,inode_obj:null}:(t.contents.delete(r),{ret:0,inode_obj:_})}path_unlink_file(e){let{ret:n,path:s}=I.from(e);if(s==null)return n;let{ret:i,parent_entry:t,filename:r,entry:_}=this.dir.get_parent_dir_and_entry_for_path(s,!1);return t==null||r==null||_==null?i:_.stat().filetype===y?31:(t.contents.delete(r),0)}path_remove_directory(e){let{ret:n,path:s}=I.from(e);if(s==null)return n;let{ret:i,parent_entry:t,filename:r,entry:_}=this.dir.get_parent_dir_and_entry_for_path(s,!1);return t==null||r==null||_==null?i:!(_ instanceof M)||_.stat().filetype!==y?54:_.contents.size!==0?55:t.contents.delete(r)?0:44}fd_filestat_get(){return{ret:0,filestat:this.dir.stat()}}fd_filestat_set_size(e){return 8}fd_read(e){return{ret:8,data:new Uint8Array}}fd_pread(e,n){return{ret:8,data:new Uint8Array}}fd_write(e){return{ret:8,nwritten:0}}fd_pwrite(e,n){return{ret:8,nwritten:0}}constructor(e){super(),this.dir=e}},te=class extends ee{fd_prestat_get(){return{ret:0,prestat:ne.dir(this.prestat_name)}}constructor(e,n){super(new M(n)),this.prestat_name=e}},F=class extends P{path_open(e,n,s){if(this.readonly&&(n&BigInt(64))==BigInt(64))return{ret:63,fd_obj:null};if((e&_e)==_e){if(this.readonly)return{ret:63,fd_obj:null};this.data=new Uint8Array([])}let i=new T(this);return s&he&&i.fd_seek(0n,re),{ret:0,fd_obj:i}}get size(){return BigInt(this.data.byteLength)}stat(){return new B(V,this.size)}constructor(e,n){super(),this.data=new Uint8Array(e),this.readonly=!!n?.readonly}},I=class Ie{static from(e){let n=new Ie;if(n.is_dir=e.endsWith("/"),e.startsWith("/"))return{ret:76,path:null};if(e.includes("\0"))return{ret:28,path:null};for(let s of e.split("/"))if(!(s===""||s===".")){if(s===".."){if(n.parts.pop()==null)return{ret:76,path:null};continue}n.parts.push(s)}return{ret:0,path:n}}to_path_string(){let e=this.parts.join("/");return this.is_dir&&(e+="/"),e}constructor(){this.parts=[],this.is_dir=!1}},M=class c extends P{path_open(e,n,s){return{ret:0,fd_obj:new ee(this)}}stat(){return new B(y,0n)}get_entry_for_path(e){let n=this;for(let s of e.parts){if(!(n instanceof c))return{ret:54,entry:null};let i=n.contents.get(s);if(i!==void 0)n=i;else return E.log(s),{ret:44,entry:null}}return e.is_dir&&n.stat().filetype!=y?{ret:54,entry:null}:{ret:0,entry:n}}get_parent_dir_and_entry_for_path(e,n){let s=e.parts.pop();if(s===void 0)return{ret:28,parent_entry:null,filename:null,entry:null};let{ret:i,entry:t}=this.get_entry_for_path(e);if(t==null)return{ret:i,parent_entry:null,filename:null,entry:null};if(!(t instanceof c))return{ret:54,parent_entry:null,filename:null,entry:null};let r=t.contents.get(s);return r===void 0?n?{ret:0,parent_entry:t,filename:s,entry:null}:{ret:44,parent_entry:null,filename:null,entry:null}:e.is_dir&&r.stat().filetype!=y?{ret:54,parent_entry:null,filename:null,entry:null}:{ret:0,parent_entry:t,filename:s,entry:r}}create_entry_for_path(e,n){let{ret:s,path:i}=I.from(e);if(i==null)return{ret:s,entry:null};let{ret:t,parent_entry:r,filename:_,entry:a}=this.get_parent_dir_and_entry_for_path(i,!0);if(r==null||_==null)return{ret:t,entry:null};if(a!=null)return{ret:20,entry:null};E.log("create",i);let o;return n?o=new c(new Map):o=new F(new ArrayBuffer(0)),r.contents.set(_,o),a=o,{ret:0,entry:a}}constructor(e){super(),e instanceof Array?this.contents=new Map(e):this.contents=e}};function Te({stdout:c,stderr:e}={stdout:console.log,stderr:console.warn}){let n,s;function i(){if(typeof n>"u")throw new Error("Memory is not set");return(s===void 0||s.buffer.byteLength===0)&&(s=new DataView(n.buffer)),s}let t=new TextDecoder;return{addToImports(r){let _=r.wasi_snapshot_preview1,a=_.fd_write;_.fd_write=(d,u,f,m)=>{if(d!==1&&d!==2)return a(d,u,f,m);let p=i(),x=Array.from({length:f},(J,Ve)=>{let ye=u+Ve*8,ze=p.getUint32(ye,!0),Me=p.getUint32(ye+4,!0);return new Uint8Array(n.buffer,ze,Me)}),R=0,A="";for(let J of x)A+=t.decode(J),R+=J.byteLength;return p.setUint32(m,R,!0),(d===1?c:e)(A),0};let o=_.fd_filestat_get;_.fd_filestat_get=(d,u)=>{if(d!==1&&d!==2)return o(d,u);let f=i(),m=o(d,u);if(m!==0)return m;let p=u+0;return f.setUint8(p,2),0};let l=_.fd_fdstat_get;_.fd_fdstat_get=(d,u)=>{if(d!==1&&d!==2)return l(d,u);let f=i(),m=u+0;f.setUint8(m,2);let p=u+8;return f.setBigUint64(p,BigInt(64),!0),0}},setMemory(r){n=r}}}var be=new DataView(new ArrayBuffer);function g(c){return be.buffer!==c.buffer&&(be=new DataView(c.buffer)),be}function Fe(c){return c>>>0}var S=new TextDecoder("utf-8"),qe=new TextEncoder("utf-8");function C(c,e,n){if(typeof c!="string")throw new TypeError("expected a string");if(c.length===0)return k=0,1;let s=0,i=0,t=0;for(;c.length>0;){i=e(i,s,1,s+c.length),s+=c.length;let{read:r,written:_}=qe.encodeInto(c,new Uint8Array(n.buffer,i+t,s-t));t+=_,c=c.slice(r)}return s>t&&(i=e(i,s,1,t)),k=t,i}var k=0,W=class{constructor(){this.list=[],this.head=0}insert(e){this.head>=this.list.length&&this.list.push({next:this.list.length+1,val:void 0});let n=this.head,s=this.list[n];return this.head=s.next,s.next=-1,s.val=e,n}get(e){if(e>=this.list.length)throw new RangeError("handle index not valid");let n=this.list[e];if(n.next===-1)return n.val;throw new RangeError("handle index not valid")}remove(e){let n=this.get(e),s=this.list[e];return s.val=void 0,s.next=this.head,this.head=e,n}};function Y(){throw new RangeError("invalid variant discriminant for bool")}var $=class{constructor(){this._resource0_slab=new W}addToImports(e){"canonical_abi"in e||(e.canonical_abi={}),e.canonical_abi["resource_drop_rb-abi-value"]=n=>{this._resource0_slab.remove(n).drop()},e.canonical_abi["resource_clone_rb-abi-value"]=n=>{let s=this._resource0_slab.get(n);return this._resource0_slab.insert(s.clone())},e.canonical_abi["resource_get_rb-abi-value"]=n=>this._resource0_slab.get(n)._wasm_val,e.canonical_abi["resource_new_rb-abi-value"]=n=>{let s=this._registry0;return this._resource0_slab.insert(new D(n,this))}}async instantiate(e,n){if(n=n||{},this.addToImports(n),e instanceof WebAssembly.Instance)this.instance=e;else if(e instanceof WebAssembly.Module)this.instance=await WebAssembly.instantiate(e,n);else if(e instanceof ArrayBuffer||e instanceof Uint8Array){let{instance:s}=await WebAssembly.instantiate(e,n);this.instance=s}else{let{instance:s}=await WebAssembly.instantiateStreaming(e,n);this.instance=s}this._exports=this.instance.exports,this._registry0=new FinalizationRegistry(this._exports["canonical_abi_drop_rb-abi-value"])}rubyShowVersion(){this._exports["ruby-show-version: func() -> ()"]()}rubyInit(e){let n=this._exports.memory,s=this._exports.cabi_realloc,i=e,t=i.length,r=s(0,0,4,t*8);for(let _=0;_<i.length;_++){let a=i[_],o=r+_*8,l=C(a,s,n),d=k;g(n).setInt32(o+4,d,!0),g(n).setInt32(o+0,l,!0)}this._exports["ruby-init: func(args: list<string>) -> ()"](r,t)}rubyInitLoadpath(){this._exports["ruby-init-loadpath: func() -> ()"]()}rbEvalStringProtect(e){let n=this._exports.memory,s=this._exports.cabi_realloc,i=C(e,s,n),t=k,r=this._exports["rb-eval-string-protect: func(str: string) -> tuple<handle<rb-abi-value>, s32>"](i,t);return[this._resource0_slab.remove(g(n).getInt32(r+0,!0)),g(n).getInt32(r+4,!0)]}rbFuncallvProtect(e,n,s){let i=this._exports.memory,t=this._exports.cabi_realloc,r=e;if(!(r instanceof D))throw new TypeError("expected instance of RbAbiValue");let _=s,a=_.length,o=t(0,0,4,a*4);for(let d=0;d<_.length;d++){let u=_[d],f=o+d*4,m=u;if(!(m instanceof D))throw new TypeError("expected instance of RbAbiValue");g(i).setInt32(f+0,this._resource0_slab.insert(m.clone()),!0)}let l=this._exports["rb-funcallv-protect: func(recv: handle<rb-abi-value>, mid: u32, args: list<handle<rb-abi-value>>) -> tuple<handle<rb-abi-value>, s32>"](this._resource0_slab.insert(r.clone()),Fe(n),o,a);return[this._resource0_slab.remove(g(i).getInt32(l+0,!0)),g(i).getInt32(l+4,!0)]}rbIntern(e){let n=this._exports.memory,s=this._exports.cabi_realloc,i=C(e,s,n),t=k;return this._exports["rb-intern: func(name: string) -> u32"](i,t)>>>0}rbErrinfo(){let e=this._exports["rb-errinfo: func() -> handle<rb-abi-value>"]();return this._resource0_slab.remove(e)}rbClearErrinfo(){this._exports["rb-clear-errinfo: func() -> ()"]()}rstringPtr(e){let n=this._exports.memory,s=e;if(!(s instanceof D))throw new TypeError("expected instance of RbAbiValue");let i=this._exports["rstring-ptr: func(value: handle<rb-abi-value>) -> string"](this._resource0_slab.insert(s.clone())),t=g(n).getInt32(i+0,!0),r=g(n).getInt32(i+4,!0),_=S.decode(new Uint8Array(n.buffer,t,r));return this._exports["cabi_post_rstring-ptr"](i),_}rbVmBugreport(){this._exports["rb-vm-bugreport: func() -> ()"]()}rbGcEnable(){let n=this._exports["rb-gc-enable: func() -> bool"]();return n==0?!1:n==1?!0:Y()}rbGcDisable(){let n=this._exports["rb-gc-disable: func() -> bool"]();return n==0?!1:n==1?!0:Y()}rbSetShouldProhibitRewind(e){let s=this._exports["rb-set-should-prohibit-rewind: func(new-value: bool) -> bool"](e?1:0);return s==0?!1:s==1?!0:Y()}},D=class{constructor(e,n){this._wasm_val=e,this._obj=n,this._refcnt=1,n._registry0.register(this,e,this)}clone(){return this._refcnt+=1,this}drop(){if(this._refcnt-=1,this._refcnt!==0)return;this._obj._registry0.unregister(this);let e=this._obj._exports["canonical_abi_drop_rb-abi-value"],n=this._wasm_val;delete this._obj,delete this._refcnt,delete this._wasm_val,e(n)}};function De(c,e,n){"rb-js-abi-host"in c||(c["rb-js-abi-host"]={}),c["rb-js-abi-host"]["eval-js: func(code: string) -> variant { success(handle<js-abi-value>), failure(handle<js-abi-value>) }"]=function(i,t,r){let _=n("memory"),a=i,o=t,l=S.decode(new Uint8Array(_.buffer,a,o)),u=e.evalJs(l);switch(u.tag){case"success":{let f=u.val;g(_).setInt8(r+0,0,!0),g(_).setInt32(r+4,s.insert(f),!0);break}case"failure":{let f=u.val;g(_).setInt8(r+0,1,!0),g(_).setInt32(r+4,s.insert(f),!0);break}default:throw new RangeError("invalid variant specified for JsAbiResult")}},c["rb-js-abi-host"]["is-js: func(value: handle<js-abi-value>) -> bool"]=function(i){return e.isJs(s.get(i))?1:0},c["rb-js-abi-host"]["instance-of: func(value: handle<js-abi-value>, klass: handle<js-abi-value>) -> bool"]=function(i,t){return e.instanceOf(s.get(i),s.get(t))?1:0},c["rb-js-abi-host"]["global-this: func() -> handle<js-abi-value>"]=function(){let i=e.globalThis();return s.insert(i)},c["rb-js-abi-host"]["int-to-js-number: func(value: s32) -> handle<js-abi-value>"]=function(i){let t=e.intToJsNumber(i);return s.insert(t)},c["rb-js-abi-host"]["float-to-js-number: func(value: float64) -> handle<js-abi-value>"]=function(i){let t=e.floatToJsNumber(i);return s.insert(t)},c["rb-js-abi-host"]["string-to-js-string: func(value: string) -> handle<js-abi-value>"]=function(i,t){let r=n("memory"),_=i,a=t,o=S.decode(new Uint8Array(r.buffer,_,a)),l=e.stringToJsString(o);return s.insert(l)},c["rb-js-abi-host"]["bool-to-js-bool: func(value: bool) -> handle<js-abi-value>"]=function(i){let t=i,r=e.boolToJsBool(t==0?!1:t==1?!0:Y());return s.insert(r)},c["rb-js-abi-host"]["proc-to-js-function: func(value: u32) -> handle<js-abi-value>"]=function(i){let t=e.procToJsFunction(i>>>0);return s.insert(t)},c["rb-js-abi-host"]["rb-object-to-js-rb-value: func(raw-rb-abi-value: u32) -> handle<js-abi-value>"]=function(i){let t=e.rbObjectToJsRbValue(i>>>0);return s.insert(t)},c["rb-js-abi-host"]["js-value-to-string: func(value: handle<js-abi-value>) -> string"]=function(i,t){let r=n("memory"),_=n("cabi_realloc"),a=e.jsValueToString(s.get(i)),o=C(a,_,r),l=k;g(r).setInt32(t+4,l,!0),g(r).setInt32(t+0,o,!0)},c["rb-js-abi-host"]["js-value-to-integer: func(value: handle<js-abi-value>) -> variant { as-float(float64), bignum(string) }"]=function(i,t){let r=n("memory"),_=n("cabi_realloc"),o=e.jsValueToInteger(s.get(i));switch(o.tag){case"as-float":{let l=o.val;g(r).setInt8(t+0,0,!0),g(r).setFloat64(t+8,+l,!0);break}case"bignum":{let l=o.val;g(r).setInt8(t+0,1,!0);let d=C(l,_,r),u=k;g(r).setInt32(t+12,u,!0),g(r).setInt32(t+8,d,!0);break}default:throw new RangeError("invalid variant specified for RawInteger")}},c["rb-js-abi-host"]["export-js-value-to-host: func(value: handle<js-abi-value>) -> ()"]=function(i){e.exportJsValueToHost(s.get(i))},c["rb-js-abi-host"]["import-js-value-from-host: func() -> handle<js-abi-value>"]=function(){let i=e.importJsValueFromHost();return s.insert(i)},c["rb-js-abi-host"]["js-value-typeof: func(value: handle<js-abi-value>) -> string"]=function(i,t){let r=n("memory"),_=n("cabi_realloc"),a=e.jsValueTypeof(s.get(i)),o=C(a,_,r),l=k;g(r).setInt32(t+4,l,!0),g(r).setInt32(t+0,o,!0)},c["rb-js-abi-host"]["js-value-equal: func(lhs: handle<js-abi-value>, rhs: handle<js-abi-value>) -> bool"]=function(i,t){return e.jsValueEqual(s.get(i),s.get(t))?1:0},c["rb-js-abi-host"]["js-value-strictly-equal: func(lhs: handle<js-abi-value>, rhs: handle<js-abi-value>) -> bool"]=function(i,t){return e.jsValueStrictlyEqual(s.get(i),s.get(t))?1:0},c["rb-js-abi-host"]["reflect-apply: func(target: handle<js-abi-value>, this-argument: handle<js-abi-value>, arguments: list<handle<js-abi-value>>) -> variant { success(handle<js-abi-value>), failure(handle<js-abi-value>) }"]=function(i,t,r,_,a){let o=n("memory"),l=_,d=r,u=[];for(let p=0;p<l;p++){let x=d+p*4;u.push(s.get(g(o).getInt32(x+0,!0)))}let m=e.reflectApply(s.get(i),s.get(t),u);switch(m.tag){case"success":{let p=m.val;g(o).setInt8(a+0,0,!0),g(o).setInt32(a+4,s.insert(p),!0);break}case"failure":{let p=m.val;g(o).setInt8(a+0,1,!0),g(o).setInt32(a+4,s.insert(p),!0);break}default:throw new RangeError("invalid variant specified for JsAbiResult")}},c["rb-js-abi-host"]["reflect-construct: func(target: handle<js-abi-value>, arguments: list<handle<js-abi-value>>) -> handle<js-abi-value>"]=function(i,t,r){let _=n("memory"),a=r,o=t,l=[];for(let u=0;u<a;u++){let f=o+u*4;l.push(s.get(g(_).getInt32(f+0,!0)))}let d=e.reflectConstruct(s.get(i),l);return s.insert(d)},c["rb-js-abi-host"]["reflect-delete-property: func(target: handle<js-abi-value>, property-key: string) -> bool"]=function(i,t,r){let _=n("memory"),a=t,o=r,l=S.decode(new Uint8Array(_.buffer,a,o));return e.reflectDeleteProperty(s.get(i),l)?1:0},c["rb-js-abi-host"]["reflect-get: func(target: handle<js-abi-value>, property-key: string) -> variant { success(handle<js-abi-value>), failure(handle<js-abi-value>) }"]=function(i,t,r,_){let a=n("memory"),o=t,l=r,d=S.decode(new Uint8Array(a.buffer,o,l)),f=e.reflectGet(s.get(i),d);switch(f.tag){case"success":{let m=f.val;g(a).setInt8(_+0,0,!0),g(a).setInt32(_+4,s.insert(m),!0);break}case"failure":{let m=f.val;g(a).setInt8(_+0,1,!0),g(a).setInt32(_+4,s.insert(m),!0);break}default:throw new RangeError("invalid variant specified for JsAbiResult")}},c["rb-js-abi-host"]["reflect-get-own-property-descriptor: func(target: handle<js-abi-value>, property-key: string) -> handle<js-abi-value>"]=function(i,t,r){let _=n("memory"),a=t,o=r,l=S.decode(new Uint8Array(_.buffer,a,o)),d=e.reflectGetOwnPropertyDescriptor(s.get(i),l);return s.insert(d)},c["rb-js-abi-host"]["reflect-get-prototype-of: func(target: handle<js-abi-value>) -> handle<js-abi-value>"]=function(i){let t=e.reflectGetPrototypeOf(s.get(i));return s.insert(t)},c["rb-js-abi-host"]["reflect-has: func(target: handle<js-abi-value>, property-key: string) -> bool"]=function(i,t,r){let _=n("memory"),a=t,o=r,l=S.decode(new Uint8Array(_.buffer,a,o));return e.reflectHas(s.get(i),l)?1:0},c["rb-js-abi-host"]["reflect-is-extensible: func(target: handle<js-abi-value>) -> bool"]=function(i){return e.reflectIsExtensible(s.get(i))?1:0},c["rb-js-abi-host"]["reflect-own-keys: func(target: handle<js-abi-value>) -> list<handle<js-abi-value>>"]=function(i,t){let r=n("memory"),_=n("cabi_realloc"),o=e.reflectOwnKeys(s.get(i)),l=o.length,d=_(0,0,4,l*4);for(let u=0;u<o.length;u++){let f=o[u],m=d+u*4;g(r).setInt32(m+0,s.insert(f),!0)}g(r).setInt32(t+4,l,!0),g(r).setInt32(t+0,d,!0)},c["rb-js-abi-host"]["reflect-prevent-extensions: func(target: handle<js-abi-value>) -> bool"]=function(i){return e.reflectPreventExtensions(s.get(i))?1:0},c["rb-js-abi-host"]["reflect-set: func(target: handle<js-abi-value>, property-key: string, value: handle<js-abi-value>) -> variant { success(handle<js-abi-value>), failure(handle<js-abi-value>) }"]=function(i,t,r,_,a){let o=n("memory"),l=t,d=r,u=S.decode(new Uint8Array(o.buffer,l,d)),m=e.reflectSet(s.get(i),u,s.get(_));switch(m.tag){case"success":{let p=m.val;g(o).setInt8(a+0,0,!0),g(o).setInt32(a+4,s.insert(p),!0);break}case"failure":{let p=m.val;g(o).setInt8(a+0,1,!0),g(o).setInt32(a+4,s.insert(p),!0);break}default:throw new RangeError("invalid variant specified for JsAbiResult")}},c["rb-js-abi-host"]["reflect-set-prototype-of: func(target: handle<js-abi-value>, prototype: handle<js-abi-value>) -> bool"]=function(i,t){return e.reflectSetPrototypeOf(s.get(i),s.get(t))?1:0},"canonical_abi"in c||(c.canonical_abi={});let s=new W;c.canonical_abi["resource_drop_js-abi-value"]=i=>{let t=s.remove(i);e.dropJsAbiValue&&e.dropJsAbiValue(t)}}var oe=class extends ${async setInstance(e){await this.instantiate(e)}},ce=class{constructor(){}setUnderlying(e){this.underlying=e}rubyShowVersion(){this.underlying.rubyShowVersion()}rubyInit(e){this.underlying.rubyInit(e)}rubyInitLoadpath(){this.underlying.rubyInitLoadpath()}rbEvalStringProtect(e){return this.underlying.rbEvalStringProtect(e)}rbFuncallvProtect(e,n,s){return this.underlying.rbFuncallvProtect(e,n,s)}rbIntern(e){return this.underlying.rbIntern(e)}rbErrinfo(){return this.underlying.rbErrinfo()}rbClearErrinfo(){return this.underlying.rbClearErrinfo()}rstringPtr(e){return this.underlying.rstringPtr(e)}rbVmBugreport(){this.underlying.rbVmBugreport()}rbGcEnable(){return this.underlying.rbGcEnable()}rbGcDisable(){return this.underlying.rbGcDisable()}rbSetShouldProhibitRewind(e){return this.underlying.rbSetShouldProhibitRewind(e)}async setInstance(e){}addToImports(e){}};var de=class c{static async instantiateModule(e){var n,s;let{module:i,wasip1:t}=e,r=new c,_={wasi_snapshot_preview1:t.wasiImport};r.addToImports(_),(n=e.addToImports)===null||n===void 0||n.call(e,_);let a=await WebAssembly.instantiate(i,_);return await r.setInstance(a),(s=e.setMemory)===null||s===void 0||s.call(e,a.exports.memory),t.initialize(a),r.initialize(e.args),{vm:r,instance:a}}static async instantiateComponent(e){let n;return"getCoreModule"in e?n=async i=>{let{instantiate:t,getCoreModule:r,wasip2:_}=e,{cli:a,clocks:o,filesystem:l,io:d,random:u,sockets:f,http:m}=_,p={"ruby:js/js-runtime":i,"wasi:cli/environment":a.environment,"wasi:cli/exit":a.exit,"wasi:cli/stderr":a.stderr,"wasi:cli/stdin":a.stdin,"wasi:cli/stdout":a.stdout,"wasi:cli/terminal-input":a.terminalInput,"wasi:cli/terminal-output":a.terminalOutput,"wasi:cli/terminal-stderr":a.terminalStderr,"wasi:cli/terminal-stdin":a.terminalStdin,"wasi:cli/terminal-stdout":a.terminalStdout,"wasi:clocks/monotonic-clock":o.monotonicClock,"wasi:clocks/wall-clock":o.wallClock,"wasi:filesystem/preopens":l.preopens,"wasi:filesystem/types":l.types,"wasi:io/error":d.error,"wasi:io/poll":d.poll,"wasi:io/streams":d.streams,"wasi:random/random":u.random,"wasi:sockets/tcp":f.tcp,"wasi:http/types":m.types,"wasi:http/incoming-handler":m.incomingHandler,"wasi:http/outgoing-handler":m.outgoingHandler};return(await t(r,p,e.instantiateCore)).rubyRuntime}:n=e.instantiate,{vm:await this._instantiate({},n)}}constructor(e){this.instance=null,this.interfaceState={hasJSFrameAfterRbFrame:!1};let n=s=>{let i=["setInstance","addToImports","instantiate","rbSetShouldProhibitRewind","rbGcDisable","rbGcEnable"],t=["constructor"].concat(i);for(let r of Object.getOwnPropertyNames($.prototype)){if(t.includes(r))continue;let _=s[r];typeof _=="function"&&(s[r]=(...a)=>{if(this.interfaceState.hasJSFrameAfterRbFrame){let l=this.guest.rbSetShouldProhibitRewind(!0),d=this.guest.rbGcDisable(),u=Reflect.apply(_,s,a);return this.guest.rbSetShouldProhibitRewind(l),d||this.guest.rbGcEnable(),u}else return Reflect.apply(_,s,a)})}return s};this.guest=n(e??new oe),this.transport=new Re,this.exceptionFormatter=new Ee}static async _instantiate(e,n){let s=new ce,i=new c(s);class t{constructor(o){this.underlying=o}}let r=i.getImports(a=>new t(a),a=>a.underlying),_=await n(Object.assign(Object.assign({},r),{throwProhibitRewindException:a=>{i.throwProhibitRewindException(a)},procToJsFunction:()=>{let a=new L(_.exportRbValueToJs(),i,i.privateObject());return new t((...o)=>a.call("call",...o.map(l=>i.wrap(l))).toJS())},rbObjectToJsRbValue:()=>{let a=new L(_.exportRbValueToJs(),i,i.privateObject());return new t(a)},JsAbiValue:t}));return s.setUnderlying(_),i.initialize(e.args),i}initialize(e=["ruby.wasm","-EUTF-8","-e_=0"]){let n=e.map(s=>s+"\0");this.guest.rubyInit(n);try{this.eval(`
        # Require Bundler standalone setup
        if File.exist?("/bundle/bundler/setup.rb")
          require "/bundle/bundler/setup.rb"
        elsif File.exist?("/bundle/setup.rb")
          # For non-CM builds, which doesn't use Bundler's standalone mode
          require "/bundle/setup.rb"
        end
      `)}catch(s){console.warn("Failed to load /bundle/setup",s)}}async setInstance(e){this.instance=e,await this.guest.setInstance(e)}addToImports(e){this.guest.addToImports(e),e["rb-js-abi-host"]={rb_wasm_throw_prohibit_rewind_exception:(n,s)=>{let i=this.instance.exports.memory,t=new TextDecoder().decode(new Uint8Array(i.buffer,n,s));this.throwProhibitRewindException(t)}},De(e,this.getImports(n=>n,n=>n),n=>this.instance.exports[n])}throwProhibitRewindException(e){let n=`Ruby APIs that may rewind the VM stack are prohibited under nested VM operation (${e})
Nested VM operation means that the call stack has sandwitched JS frames like JS -> Ruby -> JS -> Ruby caused by something like \`window.rubyVM.eval("JS.global[:rubyVM].eval('Fiber.yield')")\`

Please check your call stack and make sure that you are **not** doing any of the following inside the nested Ruby frame:
  1. Switching fibers (e.g. Fiber#resume, Fiber.yield, and Fiber#transfer)
     Note that \`evalAsync\` JS API switches fibers internally
  2. Raising uncaught exceptions
     Please catch all exceptions inside the nested operation
  3. Calling Continuation APIs
`,s=new L(this.guest.rbErrinfo(),this,this.privateObject());throw s.call("nil?").toString()==="false"&&(n+=`
`+this.exceptionFormatter.format(s,this,this.privateObject())),new ue(n)}getImports(e,n){let s=t=>{for(let[r,_]of Object.entries(t))typeof _=="function"&&(t[r]=(...a)=>{let o=this.interfaceState.hasJSFrameAfterRbFrame;this.interfaceState.hasJSFrameAfterRbFrame=!0;let l=Reflect.apply(_,t,a);return this.interfaceState.hasJSFrameAfterRbFrame=o,l});return t};function i(t){return(...r)=>{try{return{tag:"success",val:t(...r)}}catch(_){if(_ instanceof ue)throw _;return{tag:"failure",val:e(_)}}}}return s({evalJs:i(t=>e(Function(t)())),isJs:t=>!0,globalThis:()=>{if(typeof globalThis<"u")return e(globalThis);if(typeof global<"u")return e(global);if(typeof window<"u")return e(window);throw new Error("unable to locate global object")},intToJsNumber:t=>e(t),floatToJsNumber:t=>e(t),stringToJsString:t=>e(t),boolToJsBool:t=>e(t),procToJsFunction:t=>{let r=this.rbValueOfPointer(t);return e((..._)=>r.call("call",..._.map(a=>this.wrap(a))).toJS())},rbObjectToJsRbValue:t=>e(this.rbValueOfPointer(t)),jsValueToString:t=>(t=n(t),String(t)),jsValueToInteger(t){return t=n(t),typeof t=="number"?{tag:"as-float",val:t}:typeof t=="bigint"?{tag:"bignum",val:BigInt(t).toString(10)+"\0"}:typeof t=="string"?{tag:"bignum",val:t+"\0"}:typeof t>"u"?{tag:"as-float",val:0}:{tag:"as-float",val:Number(t)}},exportJsValueToHost:t=>{this.transport.takeJsValue(n(t))},importJsValueFromHost:()=>e(this.transport.consumeJsValue()),instanceOf:(t,r)=>(r=n(r),typeof r=="function"?n(t)instanceof r:!1),jsValueTypeof(t){return typeof n(t)},jsValueEqual(t,r){return n(t)==n(r)},jsValueStrictlyEqual(t,r){return n(t)===n(r)},reflectApply:i((t,r,_)=>{let a=_.map(o=>n(o));return e(Reflect.apply(n(t),n(r),a))}),reflectConstruct:function(t,r){throw new Error("Function not implemented.")},reflectDeleteProperty:function(t,r){throw new Error("Function not implemented.")},reflectGet:i((t,r)=>e(n(t)[r])),reflectGetOwnPropertyDescriptor:function(t,r){throw new Error("Function not implemented.")},reflectGetPrototypeOf:function(t){throw new Error("Function not implemented.")},reflectHas:function(t,r){throw new Error("Function not implemented.")},reflectIsExtensible:function(t){throw new Error("Function not implemented.")},reflectOwnKeys:function(t){throw new Error("Function not implemented.")},reflectPreventExtensions:function(t){throw new Error("Function not implemented.")},reflectSet:i((t,r,_)=>e(Reflect.set(n(t),r,n(_)))),reflectSetPrototypeOf:function(t,r){throw new Error("Function not implemented.")}})}printVersion(){this.guest.rubyShowVersion()}eval(e){return le(this,this.privateObject(),e)}evalAsync(e){let n=this.eval("require 'js'; JS");return Ge(this,this.privateObject(),s=>{n.call("__eval_async_rb",this.wrap(e),s)})}wrap(e){return this.transport.importJsValue(e,this)}privateObject(){return{transport:this.transport,exceptionFormatter:this.exceptionFormatter}}rbValueOfPointer(e){let n=new D(e,this.guest);return new L(n,this,this.privateObject())}},Re=class{constructor(){this._takenJsValue=null}takeJsValue(e){this._takenJsValue=e}consumeJsValue(){return this._takenJsValue}exportJsValue(e){return e.call("__export_to_js"),this._takenJsValue}importJsValue(e,n){return this._takenJsValue=e,n.eval('require "js"; JS::Object').call("__import_from_js")}},L=class c{constructor(e,n,s){this.inner=e,this.vm=n,this.privateObject=s}call(e,...n){let s=n.map(i=>i.inner);return new c(Le(this.vm,this.privateObject,this.inner,e,s),this.vm,this.privateObject)}callAsync(e,...n){let s=this.vm.eval("require 'js'; JS");return Ge(this.vm,this.privateObject,i=>{s.call("__call_async_method",this,this.vm.wrap(e),i,...n)})}[Symbol.toPrimitive](e){return e==="string"||e==="default"?this.toString():null}toString(){let e=Le(this.vm,this.privateObject,this.inner,"to_s",[]);return this.vm.guest.rstringPtr(e)}toJS(){let n=this.vm.eval("JS").call("try_convert",this);return n.call("nil?").toString()==="true"?null:this.privateObject.transport.exportJsValue(n)}},O;(function(c){c[c.None=0]="None",c[c.Return=1]="Return",c[c.Break=2]="Break",c[c.Next=3]="Next",c[c.Retry=4]="Retry",c[c.Redo=5]="Redo",c[c.Raise=6]="Raise",c[c.Throw=7]="Throw",c[c.Fatal=8]="Fatal",c[c.Mask=15]="Mask"})(O||(O={}));var Ee=class{constructor(){this.literalsCache=null,this.isFormmatting=!1}format(e,n,s){class i extends Error{}if(this.isFormmatting)throw new i("Unexpected exception occurred during formatting exception message");this.isFormmatting=!0;try{return this._format(e,n,s)}finally{this.isFormmatting=!1}}_format(e,n,s){let[i,t,r]=(()=>{if(this.literalsCache==null){let l=[le(n,s,"0"),le(n,s,"1"),le(n,s,`"
"`)];return this.literalsCache=l,l}else return this.literalsCache})(),_,a,o;try{_=e.call("class").toString()}catch{_="unknown"}try{o=e.call("message").toString()}catch{o="unknown"}try{a=e.call("backtrace")}catch{return this.formatString(_,o)}if(a.call("nil?").toString()==="true")return this.formatString(_,o);try{let l=a.call("at",i),d=a.call("drop",t).call("join",r);return this.formatString(_,o,[l.toString(),d.toString()])}catch{return this.formatString(_,o)}}formatString(e,n,s){return s?`${s[0]}: ${n} (${e})
${s[1]}`:`${e}: ${n}`}},Ue=(c,e,n)=>{switch(c&O.Mask){case O.None:break;case O.Return:throw new v("unexpected return");case O.Next:throw new v("unexpected next");case O.Break:throw new v("unexpected break");case O.Redo:throw new v("unexpected redo");case O.Retry:throw new v("retry outside of rescue clause");case O.Throw:throw new v("unexpected throw");case O.Raise:case O.Fatal:let s=new L(e.guest.rbErrinfo(),e,n);throw s.call("nil?").toString()==="true"?new v("no exception object"):(e.guest.rbClearErrinfo(),new v(n.exceptionFormatter.format(s,e,n)));default:throw new v(`unknown error tag: ${c}`)}};function Pe(c,e){try{return e()}catch(n){if(n instanceof v)throw n;try{c.guest.rbVmBugreport()}catch(s){console.error("Tried to report internal Ruby VM state but failed: ",s)}if(n instanceof WebAssembly.RuntimeError&&n.message==="unreachable"){let s=new v(`Something went wrong in Ruby VM: ${n}`);throw s.stack=n.stack,s}else throw n}}var Le=(c,e,n,s,i)=>{let t=c.guest.rbIntern(s+"\0");return Pe(c,()=>{let[r,_]=c.guest.rbFuncallvProtect(n,t,i);return Ue(_,c,e),r})},le=(c,e,n)=>Pe(c,()=>{let[s,i]=c.guest.rbEvalStringProtect(n+"\0");return Ue(i,c,e),new L(s,c,e)});function Ge(c,e,n){return new Promise((s,i)=>{let t=c.wrap({resolve:s,reject:r=>{let _=new v(e.exceptionFormatter.format(r,c,e));i(_)}});n(t)})}var v=class extends Error{constructor(e){super(e)}},ue=class extends v{constructor(e){super("Ruby Fatal Error: "+e)}};var He=async(c,e={})=>{var n,s;let i=[],t=Object.entries((n=e.env)!==null&&n!==void 0?n:{}).map(([d,u])=>`${d}=${u}`),r=[new T(new F([])),new T(new F([])),new T(new F([])),new te("/",new Map)],_=new xe(i,t,r,{debug:!1}),a=!((s=e.consolePrint)!==null&&s!==void 0)||s?Te():void 0,{vm:o,instance:l}=await de.instantiateModule({module:c,wasip1:_,addToImports:d=>{a?.addToImports(d)},setMemory:d=>{a?.setMemory(d)}});return{vm:o,wasi:_,instance:l}};var je=`
# Asteroids \u2014 Ruby port of the Frame controller. Same three systems as every
# other port. The ruby backend is native passthrough (like js/python/ts):
# handler bodies are written in native Ruby \u2014 \`if cond ... elsif ... else ... end\`,
# \`while ... end\`, 0-based arrays, true/false/nil \u2014 NOT the brace style the
# C-family/Lua/Dart backends translate. Ruby has operator overloading, so Vec2
# uses +/*; the host is duck-typed (responds to warp_out/warp_in/...).

class Vec2
  attr_accessor :x, :y
  def initialize(x = 0.0, y = 0.0)
    @x = x
    @y = y
  end
  def +(o)
    Vec2.new(@x + o.x, @y + o.y)
  end
  def *(s)
    Vec2.new(@x * s, @y * s)
  end
  def length
    Math.sqrt(@x * @x + @y * @y)
  end
  def distance_to(o)
    Math.sqrt((@x - o.x) ** 2 + (@y - o.y) ** 2)
  end
end

class Asteroid
  attr_accessor :pos, :vel, :size, :alive
  def initialize(pos, vel, size, alive)
    @pos = pos
    @vel = vel
    @size = size
    @alive = alive
  end
end

def _rf
  rand
end

def _from_angle(a, speed)
  Vec2.new(Math.cos(a) * speed, Math.sin(a) * speed)
end

# ------------------------------------------------------------ Ship
class ShipFrameEvent
    attr_accessor :_message
    attr_accessor :_parameters

    def initialize(message, parameters = [])
        @_message = message
        @_parameters = parameters
    end
end


class ShipFrameContext
    attr_accessor :_event
    attr_accessor :_return
    attr_accessor :_data
    attr_accessor :_transitioned

    def initialize(event, default_return = nil)
        @_event = event
        @_return = default_return
        @_data = {}
        @_transitioned = false
    end
end


class ShipCompartment
    attr_accessor :state
    attr_accessor :state_args
    attr_accessor :state_vars
    attr_accessor :enter_args
    attr_accessor :exit_args
    attr_accessor :forward_event
    attr_accessor :parent_compartment

    def initialize(state, parent_compartment = nil)
        @state = state
        @state_args = []
        @state_vars = {}
        @enter_args = []
        @exit_args = []
        @forward_event = nil
        @parent_compartment = parent_compartment
    end

    def copy
        c = ShipCompartment.new(@state, @parent_compartment)
        c.state_args = @state_args.dup
        c.state_vars = @state_vars.dup
        c.enter_args = @enter_args.dup
        c.exit_args = @exit_args.dup
        c.forward_event = @forward_event
        c
    end
end


class Ship
    attr_accessor :_state_stack
    attr_accessor :__compartment
    attr_accessor :__next_compartment
    attr_accessor :_context_stack
    attr_accessor :host
    attr_accessor :lives_remaining
    attr_accessor :starting_lives
    attr_accessor :hyperspaces_remaining
    attr_accessor :starting_hyperspaces

    def initialize
        @_state_stack = []
        @_context_stack = []
        @lives_remaining = 3
        @starting_lives = 3
        @hyperspaces_remaining = 3
        @starting_hyperspaces = 3
        @__compartment = __prepareEnter("Alive", [], [])
        @__next_compartment = nil
    end

    def _frame_init(host)
        @host = host
        __e = ShipFrameEvent.new("$>", @__compartment.enter_args)
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        __kernel(__e)
        @_context_stack.pop
    end

    def self._create(host)
        c = new
        c._frame_init(host)
        c
    end

    def self.hsm_chain
        {
            "Alive" => ["Alive"],
            "InHyperspace" => ["InHyperspace"],
            "Exploding" => ["Exploding"],
            "Respawning" => ["Respawning"],
            "Dead" => ["Dead"],
        }
    end
    def __prepareEnter(leaf, state_args, enter_args)
        comp = nil
        self.class.hsm_chain[leaf].each do |name|
            new_comp = ShipCompartment.new(name)
            new_comp.state_args = state_args.dup
            new_comp.enter_args = enter_args.dup
            new_comp.parent_compartment = comp
            comp = new_comp
        end
        comp
    end

    def __prepareExit(exit_args)
        comp = @__compartment
        while comp != nil
            comp.exit_args = exit_args.dup
            comp = comp.parent_compartment
        end
    end

    def __kernel(__e)
        # Route event to current state.
        __router(__e)
        # Drain any transitions queued by the handler.
        while @__next_compartment != nil
            next_compartment = @__next_compartment
            @__next_compartment = nil
            exit_event = ShipFrameEvent.new("<$", @__compartment.exit_args)
            __router(exit_event)
            @__compartment = next_compartment
            forward_event = next_compartment.forward_event
            next_compartment.forward_event = nil
            if forward_event == nil
                enter_event = ShipFrameEvent.new("$>", @__compartment.enter_args)
                __router(enter_event)
            elsif forward_event._message == "$>"
                __router(forward_event)
            else
                enter_event = ShipFrameEvent.new("$>", @__compartment.enter_args)
                __router(enter_event)
                __router(forward_event)
            end
            @_context_stack.each { |ctx| ctx._transitioned = true }
        end
    end

    def __router(__e)
        handler_name = "_state_#{@__compartment.state}"
        if respond_to?(handler_name, true)
            __send__(handler_name, __e, @__compartment)
        end
    end

    def __transition(next_compartment)
        @__next_compartment = next_compartment
    end

    def tick(dt)
        __e = ShipFrameEvent.new("tick", [dt])
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def hit
        __e = ShipFrameEvent.new("hit", [])
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def hyperspace
        __e = ShipFrameEvent.new("hyperspace", [])
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def respawn
        __e = ShipFrameEvent.new("respawn", [])
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def fire
        __e = ShipFrameEvent.new("fire", [])
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def can_fire
        __e = ShipFrameEvent.new("can_fire", [])
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def can_be_hit
        __e = ShipFrameEvent.new("can_be_hit", [])
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def can_hyperspace
        __e = ShipFrameEvent.new("can_hyperspace", [])
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def is_visible
        __e = ShipFrameEvent.new("is_visible", [])
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def is_alive
        __e = ShipFrameEvent.new("is_alive", [])
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def get_lives
        __e = ShipFrameEvent.new("get_lives", [])
        __ctx = ShipFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def _state_Alive(__e, compartment)
        if __e._message == "$>"
            self._s_Alive_hdl_frame_enter(__e, compartment)
            return
        end
        if __e._message == "can_be_hit"
            self._s_Alive_hdl_user_can_be_hit(__e, compartment)
            return
        end
        if __e._message == "can_fire"
            self._s_Alive_hdl_user_can_fire(__e, compartment)
            return
        end
        if __e._message == "can_hyperspace"
            self._s_Alive_hdl_user_can_hyperspace(__e, compartment)
            return
        end
        if __e._message == "fire"
            self._s_Alive_hdl_user_fire(__e, compartment)
            return
        end
        if __e._message == "get_lives"
            self._s_Alive_hdl_user_get_lives(__e, compartment)
            return
        end
        if __e._message == "hit"
            self._s_Alive_hdl_user_hit(__e, compartment)
            return
        end
        if __e._message == "hyperspace"
            self._s_Alive_hdl_user_hyperspace(__e, compartment)
            return
        end
        if __e._message == "is_alive"
            self._s_Alive_hdl_user_is_alive(__e, compartment)
            return
        end
        if __e._message == "is_visible"
            self._s_Alive_hdl_user_is_visible(__e, compartment)
            return
        end
        if __e._message == "tick"
            self._s_Alive_hdl_user_tick(__e, compartment)
            return
        end
    end

    def _state_InHyperspace(__e, compartment)
        if __e._message == "<$"
            self._s_InHyperspace_hdl_frame_exit(__e, compartment)
            return
        end
        if __e._message == "$>"
            self._s_InHyperspace_hdl_frame_enter(__e, compartment)
            return
        end
        if __e._message == "can_be_hit"
            self._s_InHyperspace_hdl_user_can_be_hit(__e, compartment)
            return
        end
        if __e._message == "can_fire"
            self._s_InHyperspace_hdl_user_can_fire(__e, compartment)
            return
        end
        if __e._message == "can_hyperspace"
            self._s_InHyperspace_hdl_user_can_hyperspace(__e, compartment)
            return
        end
        if __e._message == "get_lives"
            self._s_InHyperspace_hdl_user_get_lives(__e, compartment)
            return
        end
        if __e._message == "is_alive"
            self._s_InHyperspace_hdl_user_is_alive(__e, compartment)
            return
        end
        if __e._message == "is_visible"
            self._s_InHyperspace_hdl_user_is_visible(__e, compartment)
            return
        end
        if __e._message == "tick"
            self._s_InHyperspace_hdl_user_tick(__e, compartment)
            return
        end
    end

    def _state_Exploding(__e, compartment)
        if __e._message == "$>"
            self._s_Exploding_hdl_frame_enter(__e, compartment)
            return
        end
        if __e._message == "can_be_hit"
            self._s_Exploding_hdl_user_can_be_hit(__e, compartment)
            return
        end
        if __e._message == "can_fire"
            self._s_Exploding_hdl_user_can_fire(__e, compartment)
            return
        end
        if __e._message == "can_hyperspace"
            self._s_Exploding_hdl_user_can_hyperspace(__e, compartment)
            return
        end
        if __e._message == "get_lives"
            self._s_Exploding_hdl_user_get_lives(__e, compartment)
            return
        end
        if __e._message == "is_alive"
            self._s_Exploding_hdl_user_is_alive(__e, compartment)
            return
        end
        if __e._message == "is_visible"
            self._s_Exploding_hdl_user_is_visible(__e, compartment)
            return
        end
        if __e._message == "tick"
            self._s_Exploding_hdl_user_tick(__e, compartment)
            return
        end
    end

    def _state_Respawning(__e, compartment)
        if __e._message == "$>"
            self._s_Respawning_hdl_frame_enter(__e, compartment)
            return
        end
        if __e._message == "can_be_hit"
            self._s_Respawning_hdl_user_can_be_hit(__e, compartment)
            return
        end
        if __e._message == "can_fire"
            self._s_Respawning_hdl_user_can_fire(__e, compartment)
            return
        end
        if __e._message == "can_hyperspace"
            self._s_Respawning_hdl_user_can_hyperspace(__e, compartment)
            return
        end
        if __e._message == "get_lives"
            self._s_Respawning_hdl_user_get_lives(__e, compartment)
            return
        end
        if __e._message == "is_alive"
            self._s_Respawning_hdl_user_is_alive(__e, compartment)
            return
        end
        if __e._message == "is_visible"
            self._s_Respawning_hdl_user_is_visible(__e, compartment)
            return
        end
        if __e._message == "tick"
            self._s_Respawning_hdl_user_tick(__e, compartment)
            return
        end
    end

    def _state_Dead(__e, compartment)
        if __e._message == "can_be_hit"
            self._s_Dead_hdl_user_can_be_hit(__e, compartment)
            return
        end
        if __e._message == "can_fire"
            self._s_Dead_hdl_user_can_fire(__e, compartment)
            return
        end
        if __e._message == "can_hyperspace"
            self._s_Dead_hdl_user_can_hyperspace(__e, compartment)
            return
        end
        if __e._message == "get_lives"
            self._s_Dead_hdl_user_get_lives(__e, compartment)
            return
        end
        if __e._message == "is_alive"
            self._s_Dead_hdl_user_is_alive(__e, compartment)
            return
        end
        if __e._message == "is_visible"
            self._s_Dead_hdl_user_is_visible(__e, compartment)
            return
        end
        if __e._message == "respawn"
            self._s_Dead_hdl_user_respawn(__e, compartment)
            return
        end
    end

    def _s_Alive_hdl_frame_enter(__e, compartment)
        unless compartment.state_vars.key?("cooldown")
            compartment.state_vars["cooldown"] = 0.0
        end
    end

    def _s_Alive_hdl_user_can_be_hit(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = true
    end

    def _s_Alive_hdl_user_can_fire(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["cooldown"] <= 0.0
    end

    def _s_Alive_hdl_user_can_hyperspace(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.hyperspaces_remaining > 0
    end

    def _s_Alive_hdl_user_fire(__e, compartment)
        compartment.state_vars["cooldown"] = 0.22
    end

    def _s_Alive_hdl_user_get_lives(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.lives_remaining
    end

    def _s_Alive_hdl_user_hit(__e, compartment)
        __compartment = __prepareEnter("Exploding", [], [])
        __transition(__compartment)
        return
    end

    def _s_Alive_hdl_user_hyperspace(__e, compartment)
        if self.hyperspaces_remaining > 0
            self.hyperspaces_remaining = self.hyperspaces_remaining - 1
            __compartment = __prepareEnter("InHyperspace", [], [])
            __transition(__compartment)
            return
        end
    end

    def _s_Alive_hdl_user_is_alive(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = true
    end

    def _s_Alive_hdl_user_is_visible(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = true
    end

    def _s_Alive_hdl_user_tick(__e, compartment)
        dt = __e._parameters[0]
        if @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["cooldown"] > 0.0
            compartment.state_vars["cooldown"] = @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["cooldown"] - dt
        end
    end

    def _s_InHyperspace_hdl_frame_exit(__e, compartment)
        self.host.warp_in()
    end

    def _s_InHyperspace_hdl_frame_enter(__e, compartment)
        unless compartment.state_vars.key?("timer")
            compartment.state_vars["timer"] = 0.0
        end
        unless compartment.state_vars.key?("duration")
            compartment.state_vars["duration"] = 0.4
        end
        self.host.warp_out()
    end

    def _s_InHyperspace_hdl_user_can_be_hit(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_InHyperspace_hdl_user_can_fire(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_InHyperspace_hdl_user_can_hyperspace(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_InHyperspace_hdl_user_get_lives(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.lives_remaining
    end

    def _s_InHyperspace_hdl_user_is_alive(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = true
    end

    def _s_InHyperspace_hdl_user_is_visible(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_InHyperspace_hdl_user_tick(__e, compartment)
        dt = __e._parameters[0]
        compartment.state_vars["timer"] = @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["timer"] + dt
        if @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["timer"] >= @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["duration"]
            __compartment = __prepareEnter("Alive", [], [])
            __transition(__compartment)
            return
        end
    end

    def _s_Exploding_hdl_frame_enter(__e, compartment)
        unless compartment.state_vars.key?("timer")
            compartment.state_vars["timer"] = 0.0
        end
        unless compartment.state_vars.key?("duration")
            compartment.state_vars["duration"] = 1.0
        end
        self.host.spawn_explosion()
    end

    def _s_Exploding_hdl_user_can_be_hit(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Exploding_hdl_user_can_fire(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Exploding_hdl_user_can_hyperspace(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Exploding_hdl_user_get_lives(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.lives_remaining
    end

    def _s_Exploding_hdl_user_is_alive(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Exploding_hdl_user_is_visible(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = true
    end

    def _s_Exploding_hdl_user_tick(__e, compartment)
        dt = __e._parameters[0]
        compartment.state_vars["timer"] = @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["timer"] + dt
        if @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["timer"] >= @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["duration"]
            self.lives_remaining = self.lives_remaining - 1
            if self.lives_remaining <= 0
                __compartment = __prepareEnter("Dead", [], [])
                __transition(__compartment)
                return
            else
                __compartment = __prepareEnter("Respawning", [], [])
                __transition(__compartment)
                return
            end
        end
    end

    def _s_Respawning_hdl_frame_enter(__e, compartment)
        unless compartment.state_vars.key?("timer")
            compartment.state_vars["timer"] = 0.0
        end
        unless compartment.state_vars.key?("duration")
            compartment.state_vars["duration"] = 2.0
        end
        self.host.reset_ship()
    end

    def _s_Respawning_hdl_user_can_be_hit(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Respawning_hdl_user_can_fire(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = true
    end

    def _s_Respawning_hdl_user_can_hyperspace(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Respawning_hdl_user_get_lives(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.lives_remaining
    end

    def _s_Respawning_hdl_user_is_alive(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = true
    end

    def _s_Respawning_hdl_user_is_visible(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = true
    end

    def _s_Respawning_hdl_user_tick(__e, compartment)
        dt = __e._parameters[0]
        compartment.state_vars["timer"] = @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["timer"] + dt
        if @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["timer"] >= @_context_stack[@_context_stack.length - 1]._return = compartment.state_vars["duration"]
            __compartment = __prepareEnter("Alive", [], [])
            __transition(__compartment)
            return
        end
    end

    def _s_Dead_hdl_user_can_be_hit(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Dead_hdl_user_can_fire(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Dead_hdl_user_can_hyperspace(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Dead_hdl_user_get_lives(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = 0
    end

    def _s_Dead_hdl_user_is_alive(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Dead_hdl_user_is_visible(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Dead_hdl_user_respawn(__e, compartment)
        self.lives_remaining = self.starting_lives
        self.hyperspaces_remaining = self.starting_hyperspaces
        __compartment = __prepareEnter("Respawning", [], [])
        __transition(__compartment)
        return
    end

    def get_current_state_name
        return @__compartment.state 
    end

    def get_hyperspaces_remaining
        return self.hyperspaces_remaining 
    end
end

# ------------------------------------------------------------ AsteroidField
class AsteroidFieldFrameEvent
    attr_accessor :_message
    attr_accessor :_parameters

    def initialize(message, parameters = [])
        @_message = message
        @_parameters = parameters
    end
end


class AsteroidFieldFrameContext
    attr_accessor :_event
    attr_accessor :_return
    attr_accessor :_data
    attr_accessor :_transitioned

    def initialize(event, default_return = nil)
        @_event = event
        @_return = default_return
        @_data = {}
        @_transitioned = false
    end
end


class AsteroidFieldCompartment
    attr_accessor :state
    attr_accessor :state_args
    attr_accessor :state_vars
    attr_accessor :enter_args
    attr_accessor :exit_args
    attr_accessor :forward_event
    attr_accessor :parent_compartment

    def initialize(state, parent_compartment = nil)
        @state = state
        @state_args = []
        @state_vars = {}
        @enter_args = []
        @exit_args = []
        @forward_event = nil
        @parent_compartment = parent_compartment
    end

    def copy
        c = AsteroidFieldCompartment.new(@state, @parent_compartment)
        c.state_args = @state_args.dup
        c.state_vars = @state_vars.dup
        c.enter_args = @enter_args.dup
        c.exit_args = @exit_args.dup
        c.forward_event = @forward_event
        c
    end
end


class AsteroidField
    attr_accessor :_state_stack
    attr_accessor :__compartment
    attr_accessor :__next_compartment
    attr_accessor :_context_stack
    attr_accessor :asteroids

    def initialize
        @_state_stack = []
        @_context_stack = []
        @asteroids = []
        @__compartment = __prepareEnter("Active", [], [])
        @__next_compartment = nil
    end

    def _frame_init
        __e = AsteroidFieldFrameEvent.new("$>", @__compartment.enter_args)
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        __kernel(__e)
        @_context_stack.pop
    end

    def self._create
        c = new
        c._frame_init()
        c
    end

    def self.hsm_chain
        {
            "Active" => ["Active"],
        }
    end
    def __prepareEnter(leaf, state_args, enter_args)
        comp = nil
        self.class.hsm_chain[leaf].each do |name|
            new_comp = AsteroidFieldCompartment.new(name)
            new_comp.state_args = state_args.dup
            new_comp.enter_args = enter_args.dup
            new_comp.parent_compartment = comp
            comp = new_comp
        end
        comp
    end

    def __prepareExit(exit_args)
        comp = @__compartment
        while comp != nil
            comp.exit_args = exit_args.dup
            comp = comp.parent_compartment
        end
    end

    def __kernel(__e)
        # Route event to current state.
        __router(__e)
        # Drain any transitions queued by the handler.
        while @__next_compartment != nil
            next_compartment = @__next_compartment
            @__next_compartment = nil
            exit_event = AsteroidFieldFrameEvent.new("<$", @__compartment.exit_args)
            __router(exit_event)
            @__compartment = next_compartment
            forward_event = next_compartment.forward_event
            next_compartment.forward_event = nil
            if forward_event == nil
                enter_event = AsteroidFieldFrameEvent.new("$>", @__compartment.enter_args)
                __router(enter_event)
            elsif forward_event._message == "$>"
                __router(forward_event)
            else
                enter_event = AsteroidFieldFrameEvent.new("$>", @__compartment.enter_args)
                __router(enter_event)
                __router(forward_event)
            end
            @_context_stack.each { |ctx| ctx._transitioned = true }
        end
    end

    def __router(__e)
        handler_name = "_state_#{@__compartment.state}"
        if respond_to?(handler_name, true)
            __send__(handler_name, __e, @__compartment)
        end
    end

    def __transition(next_compartment)
        @__next_compartment = next_compartment
    end

    def spawn_wave(count, court_size)
        __e = AsteroidFieldFrameEvent.new("spawn_wave", [count, court_size])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def split(index)
        __e = AsteroidFieldFrameEvent.new("split", [index])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def remove(index)
        __e = AsteroidFieldFrameEvent.new("remove", [index])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def clear
        __e = AsteroidFieldFrameEvent.new("clear", [])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def advance(dt, court_size)
        __e = AsteroidFieldFrameEvent.new("advance", [dt, court_size])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def count
        __e = AsteroidFieldFrameEvent.new("count", [])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def alive_count
        __e = AsteroidFieldFrameEvent.new("alive_count", [])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def is_alive(index)
        __e = AsteroidFieldFrameEvent.new("is_alive", [index])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def position(index)
        __e = AsteroidFieldFrameEvent.new("position", [index])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def velocity(index)
        __e = AsteroidFieldFrameEvent.new("velocity", [index])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def size_of(index)
        __e = AsteroidFieldFrameEvent.new("size_of", [index])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def radius_of(index)
        __e = AsteroidFieldFrameEvent.new("radius_of", [index])
        __ctx = AsteroidFieldFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def _state_Active(__e, compartment)
        if __e._message == "advance"
            self._s_Active_hdl_user_advance(__e, compartment)
            return
        end
        if __e._message == "alive_count"
            self._s_Active_hdl_user_alive_count(__e, compartment)
            return
        end
        if __e._message == "clear"
            self._s_Active_hdl_user_clear(__e, compartment)
            return
        end
        if __e._message == "count"
            self._s_Active_hdl_user_count(__e, compartment)
            return
        end
        if __e._message == "is_alive"
            self._s_Active_hdl_user_is_alive(__e, compartment)
            return
        end
        if __e._message == "position"
            self._s_Active_hdl_user_position(__e, compartment)
            return
        end
        if __e._message == "radius_of"
            self._s_Active_hdl_user_radius_of(__e, compartment)
            return
        end
        if __e._message == "remove"
            self._s_Active_hdl_user_remove(__e, compartment)
            return
        end
        if __e._message == "size_of"
            self._s_Active_hdl_user_size_of(__e, compartment)
            return
        end
        if __e._message == "spawn_wave"
            self._s_Active_hdl_user_spawn_wave(__e, compartment)
            return
        end
        if __e._message == "split"
            self._s_Active_hdl_user_split(__e, compartment)
            return
        end
        if __e._message == "velocity"
            self._s_Active_hdl_user_velocity(__e, compartment)
            return
        end
    end

    def _s_Active_hdl_user_advance(__e, compartment)
        dt = __e._parameters[0]
        court_size = __e._parameters[1]
        i = 0
        while i < self.asteroids.length
            if self.asteroids[i].alive
                self.asteroids[i].pos = self.asteroids[i].pos + self.asteroids[i].vel * dt
                if self.asteroids[i].pos.x < 0.0
                    self.asteroids[i].pos.x = self.asteroids[i].pos.x + court_size.x
                end
                if self.asteroids[i].pos.x > court_size.x
                    self.asteroids[i].pos.x = self.asteroids[i].pos.x - court_size.x
                end
                if self.asteroids[i].pos.y < 0.0
                    self.asteroids[i].pos.y = self.asteroids[i].pos.y + court_size.y
                end
                if self.asteroids[i].pos.y > court_size.y
                    self.asteroids[i].pos.y = self.asteroids[i].pos.y - court_size.y
                end
            end
            i = i + 1
        end
    end

    def _s_Active_hdl_user_alive_count(__e, compartment)
                        c = 0
                        i = 0
                        while i < self.asteroids.length
                            if self.asteroids[i].alive
                                c = c + 1
                            end
                            i = i + 1
                        end
        @_context_stack[@_context_stack.length - 1]._return = c
    end

    def _s_Active_hdl_user_clear(__e, compartment)
        self.asteroids = []
    end

    def _s_Active_hdl_user_count(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.asteroids.length
    end

    def _s_Active_hdl_user_is_alive(__e, compartment)
        index = __e._parameters[0]
                        if index < 0 || index >= self.asteroids.length
        @_context_stack[@_context_stack.length - 1]._return = false
                            return
                        end
        @_context_stack[@_context_stack.length - 1]._return = self.asteroids[index].alive
    end

    def _s_Active_hdl_user_position(__e, compartment)
        index = __e._parameters[0]
                        if index < 0 || index >= self.asteroids.length
        @_context_stack[@_context_stack.length - 1]._return = Vec2.new(0, 0)
                            return
                        end
        @_context_stack[@_context_stack.length - 1]._return = self.asteroids[index].pos
    end

    def _s_Active_hdl_user_radius_of(__e, compartment)
        index = __e._parameters[0]
                        if index < 0 || index >= self.asteroids.length
        @_context_stack[@_context_stack.length - 1]._return = 0.0
                            return
                        end
                        sz = self.asteroids[index].size
                        if sz == 3
        @_context_stack[@_context_stack.length - 1]._return = 32.0
                            return
                        end
                        if sz == 2
        @_context_stack[@_context_stack.length - 1]._return = 18.0
                            return
                        end
        @_context_stack[@_context_stack.length - 1]._return = 10.0
    end

    def _s_Active_hdl_user_remove(__e, compartment)
        index = __e._parameters[0]
        if index < 0 || index >= self.asteroids.length
            return
        end
        self.asteroids[index].alive = false
    end

    def _s_Active_hdl_user_size_of(__e, compartment)
        index = __e._parameters[0]
                        if index < 0 || index >= self.asteroids.length
        @_context_stack[@_context_stack.length - 1]._return = 0
                            return
                        end
        @_context_stack[@_context_stack.length - 1]._return = self.asteroids[index].size
    end

    def _s_Active_hdl_user_spawn_wave(__e, compartment)
        count = __e._parameters[0]
        court_size = __e._parameters[1]
        self.asteroids = []
        i = 0
        while i < count
            self.spawn_large(court_size)
            i = i + 1
        end
    end

    def _s_Active_hdl_user_split(__e, compartment)
        index = __e._parameters[0]
                        if index < 0 || index >= self.asteroids.length
        @_context_stack[@_context_stack.length - 1]._return = false
                            return
                        end
                        if !self.asteroids[index].alive
        @_context_stack[@_context_stack.length - 1]._return = false
                            return
                        end
                        self.asteroids[index].alive = false
                        sz = self.asteroids[index].size
                        p = self.asteroids[index].pos
                        if sz > 1
                            self.spawn_child(p, sz - 1)
                            self.spawn_child(p, sz - 1)
                        end
        @_context_stack[@_context_stack.length - 1]._return = true
    end

    def _s_Active_hdl_user_velocity(__e, compartment)
        index = __e._parameters[0]
                        if index < 0 || index >= self.asteroids.length
        @_context_stack[@_context_stack.length - 1]._return = Vec2.new(0, 0)
                            return
                        end
        @_context_stack[@_context_stack.length - 1]._return = self.asteroids[index].vel
    end

    def spawn_large(court_size)
        edge = (_rf() * 4).floor
        pos = Vec2.new(0.0, 0.0)
        if edge == 0
            pos = Vec2.new(0.0, _rf() * court_size.y)
        elsif edge == 1
            pos = Vec2.new(court_size.x, _rf() * court_size.y)
        elsif edge == 2
            pos = Vec2.new(_rf() * court_size.x, 0.0)
        else
            pos = Vec2.new(_rf() * court_size.x, court_size.y)
        end
        angle = _rf() * 2.0 * Math::PI
        speed = 40.0 + _rf() * 30.0
        vel = _from_angle(angle, speed)
        self.asteroids.push(Asteroid.new(pos, vel, 3, true))
    end

    def spawn_child(pos, size)
        angle = _rf() * 2.0 * Math::PI
        speed = 60.0 + _rf() * 40.0 + (3 - size) * 20.0
        vel = _from_angle(angle, speed)
        self.asteroids.push(Asteroid.new(pos, vel, size, true))
    end
end

# ------------------------------------------------------------ AsteroidsGame
class AsteroidsGameFrameEvent
    attr_accessor :_message
    attr_accessor :_parameters

    def initialize(message, parameters = [])
        @_message = message
        @_parameters = parameters
    end
end


class AsteroidsGameFrameContext
    attr_accessor :_event
    attr_accessor :_return
    attr_accessor :_data
    attr_accessor :_transitioned

    def initialize(event, default_return = nil)
        @_event = event
        @_return = default_return
        @_data = {}
        @_transitioned = false
    end
end


class AsteroidsGameCompartment
    attr_accessor :state
    attr_accessor :state_args
    attr_accessor :state_vars
    attr_accessor :enter_args
    attr_accessor :exit_args
    attr_accessor :forward_event
    attr_accessor :parent_compartment

    def initialize(state, parent_compartment = nil)
        @state = state
        @state_args = []
        @state_vars = {}
        @enter_args = []
        @exit_args = []
        @forward_event = nil
        @parent_compartment = parent_compartment
    end

    def copy
        c = AsteroidsGameCompartment.new(@state, @parent_compartment)
        c.state_args = @state_args.dup
        c.state_vars = @state_vars.dup
        c.enter_args = @enter_args.dup
        c.exit_args = @exit_args.dup
        c.forward_event = @forward_event
        c
    end
end


class AsteroidsGame
    attr_accessor :_state_stack
    attr_accessor :__compartment
    attr_accessor :__next_compartment
    attr_accessor :_context_stack
    attr_accessor :difficulty
    attr_accessor :score
    attr_accessor :wave
    attr_accessor :wave_timer
    attr_accessor :wave_pause
    attr_accessor :bullets_in_flight
    attr_accessor :max_bullets
    attr_accessor :last_court_size
    attr_accessor :ship
    attr_accessor :field

    def initialize
        @_state_stack = []
        @_context_stack = []
        @score = 0
        @wave = 1
        @wave_timer = 0.0
        @wave_pause = 2.0
        @bullets_in_flight = 0
        @max_bullets = 4
        @last_court_size = Vec2.new(640, 480)
        @field = AsteroidField._create
        @__compartment = __prepareEnter("Attract", [], [])
        @__next_compartment = nil
    end

    def _frame_init(ship_host, difficulty)
        @difficulty = difficulty
        @ship = Ship._create(ship_host)
        __e = AsteroidsGameFrameEvent.new("$>", @__compartment.enter_args)
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        __kernel(__e)
        @_context_stack.pop
    end

    def self._create(ship_host, difficulty)
        c = new
        c._frame_init(ship_host, difficulty)
        c
    end

    def self.hsm_chain
        {
            "Attract" => ["Attract"],
            "InGame" => ["InGame"],
            "Playing" => ["InGame", "Playing"],
            "ShipDying" => ["InGame", "ShipDying"],
            "WaveClear" => ["InGame", "WaveClear"],
            "Paused" => ["Paused"],
            "GameOver" => ["GameOver"],
        }
    end
    def __prepareEnter(leaf, state_args, enter_args)
        comp = nil
        self.class.hsm_chain[leaf].each do |name|
            new_comp = AsteroidsGameCompartment.new(name)
            new_comp.state_args = state_args.dup
            new_comp.enter_args = enter_args.dup
            new_comp.parent_compartment = comp
            comp = new_comp
        end
        comp
    end

    def __prepareExit(exit_args)
        comp = @__compartment
        while comp != nil
            comp.exit_args = exit_args.dup
            comp = comp.parent_compartment
        end
    end

    def __kernel(__e)
        # Route event to current state.
        __router(__e)
        # Drain any transitions queued by the handler.
        while @__next_compartment != nil
            next_compartment = @__next_compartment
            @__next_compartment = nil
            exit_event = AsteroidsGameFrameEvent.new("<$", @__compartment.exit_args)
            __router(exit_event)
            @__compartment = next_compartment
            forward_event = next_compartment.forward_event
            next_compartment.forward_event = nil
            if forward_event == nil
                enter_event = AsteroidsGameFrameEvent.new("$>", @__compartment.enter_args)
                __router(enter_event)
            elsif forward_event._message == "$>"
                __router(forward_event)
            else
                enter_event = AsteroidsGameFrameEvent.new("$>", @__compartment.enter_args)
                __router(enter_event)
                __router(forward_event)
            end
            @_context_stack.each { |ctx| ctx._transitioned = true }
        end
    end

    def __router(__e)
        handler_name = "_state_#{@__compartment.state}"
        if respond_to?(handler_name, true)
            __send__(handler_name, __e, @__compartment)
        end
    end

    def __transition(next_compartment)
        @__next_compartment = next_compartment
    end

    def start
        __e = AsteroidsGameFrameEvent.new("start", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def restart
        __e = AsteroidsGameFrameEvent.new("restart", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def pause
        __e = AsteroidsGameFrameEvent.new("pause", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def resume
        __e = AsteroidsGameFrameEvent.new("resume", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def tick(dt, court_size)
        __e = AsteroidsGameFrameEvent.new("tick", [dt, court_size])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def ship_hit_asteroid(index)
        __e = AsteroidsGameFrameEvent.new("ship_hit_asteroid", [index])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def bullet_hit_asteroid(index)
        __e = AsteroidsGameFrameEvent.new("bullet_hit_asteroid", [index])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def ship_hyperspace
        __e = AsteroidsGameFrameEvent.new("ship_hyperspace", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def bullet_fired
        __e = AsteroidsGameFrameEvent.new("bullet_fired", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def bullet_expired
        __e = AsteroidsGameFrameEvent.new("bullet_expired", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def get_score
        __e = AsteroidsGameFrameEvent.new("get_score", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def get_lives
        __e = AsteroidsGameFrameEvent.new("get_lives", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def get_wave
        __e = AsteroidsGameFrameEvent.new("get_wave", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def get_difficulty
        __e = AsteroidsGameFrameEvent.new("get_difficulty", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def is_paused
        __e = AsteroidsGameFrameEvent.new("is_paused", [])
        __ctx = AsteroidsGameFrameContext.new(__e, nil)
        @_context_stack.push(__ctx)
        begin
            __kernel(__e)
            return @_context_stack.last._return
        ensure
            @_context_stack.pop
        end
    end

    def _state_Attract(__e, compartment)
        if __e._message == "$>"
            self._s_Attract_hdl_frame_enter(__e, compartment)
            return
        end
        if __e._message == "get_difficulty"
            self._s_Attract_hdl_user_get_difficulty(__e, compartment)
            return
        end
        if __e._message == "get_lives"
            self._s_Attract_hdl_user_get_lives(__e, compartment)
            return
        end
        if __e._message == "get_score"
            self._s_Attract_hdl_user_get_score(__e, compartment)
            return
        end
        if __e._message == "get_wave"
            self._s_Attract_hdl_user_get_wave(__e, compartment)
            return
        end
        if __e._message == "is_paused"
            self._s_Attract_hdl_user_is_paused(__e, compartment)
            return
        end
        if __e._message == "start"
            self._s_Attract_hdl_user_start(__e, compartment)
            return
        end
    end

    def _state_InGame(__e, compartment)
        if __e._message == "bullet_expired"
            self._s_InGame_hdl_user_bullet_expired(__e, compartment)
            return
        end
        if __e._message == "bullet_fired"
            self._s_InGame_hdl_user_bullet_fired(__e, compartment)
            return
        end
        if __e._message == "get_difficulty"
            self._s_InGame_hdl_user_get_difficulty(__e, compartment)
            return
        end
        if __e._message == "get_lives"
            self._s_InGame_hdl_user_get_lives(__e, compartment)
            return
        end
        if __e._message == "get_score"
            self._s_InGame_hdl_user_get_score(__e, compartment)
            return
        end
        if __e._message == "get_wave"
            self._s_InGame_hdl_user_get_wave(__e, compartment)
            return
        end
        if __e._message == "is_paused"
            self._s_InGame_hdl_user_is_paused(__e, compartment)
            return
        end
        if __e._message == "pause"
            self._s_InGame_hdl_user_pause(__e, compartment)
            return
        end
    end

    def _state_Playing(__e, compartment)
        if __e._message == "bullet_hit_asteroid"
            self._s_Playing_hdl_user_bullet_hit_asteroid(__e, compartment)
            return
        end
        if __e._message == "ship_hit_asteroid"
            self._s_Playing_hdl_user_ship_hit_asteroid(__e, compartment)
            return
        end
        if __e._message == "ship_hyperspace"
            self._s_Playing_hdl_user_ship_hyperspace(__e, compartment)
            return
        end
        if __e._message == "tick"
            self._s_Playing_hdl_user_tick(__e, compartment)
            return
        end
        self._state_InGame(__e, compartment.parent_compartment)
    end

    def _state_ShipDying(__e, compartment)
        if __e._message == "tick"
            self._s_ShipDying_hdl_user_tick(__e, compartment)
            return
        end
        self._state_InGame(__e, compartment.parent_compartment)
    end

    def _state_WaveClear(__e, compartment)
        if __e._message == "$>"
            self._s_WaveClear_hdl_frame_enter(__e, compartment)
            return
        end
        if __e._message == "tick"
            self._s_WaveClear_hdl_user_tick(__e, compartment)
            return
        end
        self._state_InGame(__e, compartment.parent_compartment)
    end

    def _state_Paused(__e, compartment)
        if __e._message == "get_difficulty"
            self._s_Paused_hdl_user_get_difficulty(__e, compartment)
            return
        end
        if __e._message == "get_lives"
            self._s_Paused_hdl_user_get_lives(__e, compartment)
            return
        end
        if __e._message == "get_score"
            self._s_Paused_hdl_user_get_score(__e, compartment)
            return
        end
        if __e._message == "get_wave"
            self._s_Paused_hdl_user_get_wave(__e, compartment)
            return
        end
        if __e._message == "is_paused"
            self._s_Paused_hdl_user_is_paused(__e, compartment)
            return
        end
        if __e._message == "resume"
            self._s_Paused_hdl_user_resume(__e, compartment)
            return
        end
    end

    def _state_GameOver(__e, compartment)
        if __e._message == "get_difficulty"
            self._s_GameOver_hdl_user_get_difficulty(__e, compartment)
            return
        end
        if __e._message == "get_lives"
            self._s_GameOver_hdl_user_get_lives(__e, compartment)
            return
        end
        if __e._message == "get_score"
            self._s_GameOver_hdl_user_get_score(__e, compartment)
            return
        end
        if __e._message == "get_wave"
            self._s_GameOver_hdl_user_get_wave(__e, compartment)
            return
        end
        if __e._message == "is_paused"
            self._s_GameOver_hdl_user_is_paused(__e, compartment)
            return
        end
        if __e._message == "restart"
            self._s_GameOver_hdl_user_restart(__e, compartment)
            return
        end
    end

    def _s_Attract_hdl_frame_enter(__e, compartment)
        self.score = 0
        self.wave = 1
        self.bullets_in_flight = 0
    end

    def _s_Attract_hdl_user_get_difficulty(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.difficulty
    end

    def _s_Attract_hdl_user_get_lives(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.ship.get_lives()
    end

    def _s_Attract_hdl_user_get_score(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.score
    end

    def _s_Attract_hdl_user_get_wave(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.wave
    end

    def _s_Attract_hdl_user_is_paused(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_Attract_hdl_user_start(__e, compartment)
        self.ship.respawn()
        n = self.asteroids_for_wave(1)
        self.field.spawn_wave(n, self.last_court_size)
        __compartment = __prepareEnter("Playing", [], [])
        __transition(__compartment)
        return
    end

    def _s_InGame_hdl_user_bullet_expired(__e, compartment)
        if self.bullets_in_flight > 0
            self.bullets_in_flight = self.bullets_in_flight - 1
        end
    end

    def _s_InGame_hdl_user_bullet_fired(__e, compartment)
        self.bullets_in_flight = self.bullets_in_flight + 1
    end

    def _s_InGame_hdl_user_get_difficulty(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.difficulty
    end

    def _s_InGame_hdl_user_get_lives(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.ship.get_lives()
    end

    def _s_InGame_hdl_user_get_score(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.score
    end

    def _s_InGame_hdl_user_get_wave(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.wave
    end

    def _s_InGame_hdl_user_is_paused(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_InGame_hdl_user_pause(__e, compartment)
        @_state_stack.push(@__compartment)
        __transition(AsteroidsGameCompartment.new("Paused"))
        return
    end

    def _s_Playing_hdl_user_bullet_hit_asteroid(__e, compartment)
        index = __e._parameters[0]
        if self.field.split(index)
            sz = self.size_points(index)
            self.score = self.score + sz * self.difficulty
            if self.field.alive_count() <= 0
                __compartment = __prepareEnter("WaveClear", [], [])
                __transition(__compartment)
                return
            end
        end
    end

    def _s_Playing_hdl_user_ship_hit_asteroid(__e, compartment)
        index = __e._parameters[0]
        if !self.ship.can_be_hit()
            return
        end
        self.ship.hit()
        __compartment = __prepareEnter("ShipDying", [], [])
        __transition(__compartment)
        return
    end

    def _s_Playing_hdl_user_ship_hyperspace(__e, compartment)
        self.ship.hyperspace()
    end

    def _s_Playing_hdl_user_tick(__e, compartment)
        dt = __e._parameters[0]
        court_size = __e._parameters[1]
        self.last_court_size = court_size
        self.ship.tick(dt)
        self.field.advance(dt, court_size)
    end

    def _s_ShipDying_hdl_user_tick(__e, compartment)
        dt = __e._parameters[0]
        court_size = __e._parameters[1]
        self.last_court_size = court_size
        self.ship.tick(dt)
        self.field.advance(dt, court_size)
        if self.ship.get_current_state_name() == "Respawning"
            __compartment = __prepareEnter("Playing", [], [])
            __transition(__compartment)
            return
        elsif self.ship.get_current_state_name() == "Dead"
            __compartment = __prepareEnter("GameOver", [], [])
            __transition(__compartment)
            return
        end
    end

    def _s_WaveClear_hdl_frame_enter(__e, compartment)
        self.wave_timer = 0.0
    end

    def _s_WaveClear_hdl_user_tick(__e, compartment)
        dt = __e._parameters[0]
        court_size = __e._parameters[1]
        self.last_court_size = court_size
        self.ship.tick(dt)
        self.wave_timer = self.wave_timer + dt
        if self.wave_timer >= self.wave_pause
            self.wave = self.wave + 1
            n = self.asteroids_for_wave(self.wave)
            self.field.spawn_wave(n, court_size)
            __compartment = __prepareEnter("Playing", [], [])
            __transition(__compartment)
            return
        end
    end

    def _s_Paused_hdl_user_get_difficulty(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.difficulty
    end

    def _s_Paused_hdl_user_get_lives(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.ship.get_lives()
    end

    def _s_Paused_hdl_user_get_score(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.score
    end

    def _s_Paused_hdl_user_get_wave(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.wave
    end

    def _s_Paused_hdl_user_is_paused(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = true
    end

    def _s_Paused_hdl_user_resume(__e, compartment)
        __saved = @_state_stack.pop
        __transition(__saved)
        return
    end

    def _s_GameOver_hdl_user_get_difficulty(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.difficulty
    end

    def _s_GameOver_hdl_user_get_lives(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.ship.get_lives()
    end

    def _s_GameOver_hdl_user_get_score(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.score
    end

    def _s_GameOver_hdl_user_get_wave(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = self.wave
    end

    def _s_GameOver_hdl_user_is_paused(__e, compartment)
        @_context_stack[@_context_stack.length - 1]._return = false
    end

    def _s_GameOver_hdl_user_restart(__e, compartment)
        __compartment = __prepareEnter("Attract", [], [])
        __transition(__compartment)
        return
    end

    def asteroids_for_wave(wave)
        base_count = 2 + self.difficulty
        return base_count + wave - 1
    end

    def size_points(index)
        sz = self.field.size_of(index)
        if sz == 3
            return 20
        end
        if sz == 2
            return 50
        end
        return 100
    end

    def get_current_state_name
        return @__compartment.state 
    end

    def get_bullets_in_flight
        return self.bullets_in_flight 
    end

    def get_max_bullets
        return self.max_bullets 
    end
end

`;var Be=`# Asteroids \u2014 Ruby host for the Frame AsteroidsGame controller. Same FSM as the
# other ports (asteroids.rb); this is the engine layer, written in Ruby and run
# in the browser by ruby.wasm. Rendering is HTML canvas 2D via the \`js\` interop
# library (ctx.call(:method, ...)); input + the rAF loop + live-state all go
# through JS.global. The four ShipHost callbacks are plain Ruby methods.
require "js"

COURT_W = 800
COURT_H = 600
TWO_PI  = Math::PI * 2

COL_SHIP   = "#8ab4f8"
COL_ROCK   = "#9aa4b8"
COL_BULLET = "#ffffff"
COL_FLAME  = "#ffad42"
COL_TEXT   = "#ffffff"

SHIP_THRUST = 240.0
SHIP_ROT    = 4.0
SHIP_MAX    = 320.0
SHIP_DRAG   = 0.5
SHIP_SIZE   = 14.0
BULLET_SPEED = 500.0
BULLET_LIFE  = 1.2
BULLET_SIZE  = 2.4

class Game
  attr_reader :fsm

  def initialize(canvas)
    @canvas = canvas
    @ctx = canvas.call(:getContext, "2d")
    @fsm = AsteroidsGame._create(self, 2)
    @court = Vec2.new(COURT_W, COURT_H)
    @ship_pos = Vec2.new(COURT_W / 2.0, COURT_H / 2.0)
    @ship_vel = Vec2.new(0.0, 0.0)
    @ship_angle = -Math::PI / 2
    @bullets = []          # each: [pos, vel, life]
    @keys = {}
    @last_pub = ""
    @chan = make_channel
    reset_ship
  end

  def make_channel
    JS.global[:BroadcastChannel].new("frame-games:state:asteroids")
  rescue StandardError
    nil
  end

  # \u2500\u2500 ShipHost \u2500\u2500
  def warp_out
    @ship_pos = Vec2.new(rand * COURT_W, rand * COURT_H)
    @ship_vel = Vec2.new(0.0, 0.0)
  end

  def warp_in; end
  def spawn_explosion; end

  def reset_ship
    @ship_pos = Vec2.new(COURT_W / 2.0, COURT_H / 2.0)
    @ship_vel = Vec2.new(0.0, 0.0)
    @ship_angle = -Math::PI / 2
    @bullets.each { @fsm.bullet_expired }
    @bullets = []
  end

  # \u2500\u2500 input \u2500\u2500
  def thrust_held
    @keys["ArrowUp"] || @keys["KeyW"]
  end

  def on_keydown(code)
    state = @fsm.get_current_state_name
    if state == "Attract"
      @fsm.start
      @bullets = []
      return
    end
    if state == "GameOver"
      if code == "KeyR"
        @fsm.restart
        @fsm.start
        @bullets = []
      end
      return
    end
    if code == "KeyP"
      @fsm.is_paused ? @fsm.resume : @fsm.pause
      return
    end
    return if @fsm.is_paused
    if code == "KeyH" && @fsm.ship.can_hyperspace
      @fsm.ship_hyperspace
    end
  end

  # \u2500\u2500 frame \u2500\u2500
  def update(dt)
    state = @fsm.get_current_state_name
    return if state == "Attract" || state == "GameOver" || @fsm.is_paused
    handle_input(dt)
    @fsm.tick(dt, @court)
    update_ship(dt)
    update_bullets(dt)
    check_collisions
  end

  def handle_input(dt)
    return unless @fsm.ship.is_visible
    @ship_angle -= SHIP_ROT * dt if @keys["ArrowLeft"] || @keys["KeyA"]
    @ship_angle += SHIP_ROT * dt if @keys["ArrowRight"] || @keys["KeyD"]
    ss = @fsm.ship.get_current_state_name
    if (ss == "Alive" || ss == "Respawning") && thrust_held
      @ship_vel = @ship_vel + Vec2.new(Math.cos(@ship_angle), Math.sin(@ship_angle)) * (SHIP_THRUST * dt)
      @ship_vel = @ship_vel * (SHIP_MAX / @ship_vel.length) if @ship_vel.length > SHIP_MAX
    end
    if @fsm.ship.can_fire && @fsm.get_bullets_in_flight < @fsm.get_max_bullets && @keys["Space"]
      try_fire
    end
  end

  def try_fire
    @fsm.ship.fire
    d = Vec2.new(Math.cos(@ship_angle), Math.sin(@ship_angle))
    @bullets.push([@ship_pos + d * SHIP_SIZE, d * BULLET_SPEED + @ship_vel, 0.0])
    @fsm.bullet_fired
  end

  def wrap(p)
    p.x += COURT_W if p.x < 0
    p.x -= COURT_W if p.x > COURT_W
    p.y += COURT_H if p.y < 0
    p.y -= COURT_H if p.y > COURT_H
  end

  def update_ship(dt)
    return unless @fsm.ship.is_visible
    @ship_vel = @ship_vel * (1.0 - SHIP_DRAG * dt)
    @ship_pos = @ship_pos + @ship_vel * dt
    wrap(@ship_pos)
  end

  def update_bullets(dt)
    (@bullets.length - 1).downto(0) do |i|
      b = @bullets[i]
      b[0] = b[0] + b[1] * dt
      b[2] += dt
      wrap(b[0])
      if b[2] >= BULLET_LIFE
        @bullets.delete_at(i)
        @fsm.bullet_expired
      end
    end
  end

  def check_collisions
    total = @fsm.field.count
    (@bullets.length - 1).downto(0) do |bi|
      bp = @bullets[bi][0]
      hit = -1
      i = 0
      while i < total
        if @fsm.field.is_alive(i) && @fsm.field.position(i).distance_to(bp) < @fsm.field.radius_of(i)
          hit = i
          break
        end
        i += 1
      end
      if hit >= 0
        @fsm.bullet_hit_asteroid(hit)
        @bullets.delete_at(bi)
        @fsm.bullet_expired
      end
    end
    if @fsm.ship.can_be_hit
      i = 0
      while i < total
        if @fsm.field.is_alive(i) && @fsm.field.position(i).distance_to(@ship_pos) < @fsm.field.radius_of(i) + SHIP_SIZE * 0.6
          @fsm.ship_hit_asteroid(i)
          break
        end
        i += 1
      end
    end
  end

  def publish_state
    g = @fsm.get_current_state_name
    s = @fsm.ship.get_current_state_name
    snap = "#{g}|#{s}"
    return if snap == @last_pub
    @last_pub = snap
    return if @chan.nil?
    msg = JS.eval("return {}")
    msg[:AsteroidsGame] = g
    msg[:Ship] = s
    msg[:AsteroidField] = "Active"
    @chan.call(:postMessage, msg)
  end

  # \u2500\u2500 render \u2500\u2500
  def draw(now)
    c = @ctx
    c[:fillStyle] = "#000000"
    c.call(:fillRect, 0, 0, COURT_W, COURT_H)
    state = @fsm.get_current_state_name
    total = @fsm.field.count

    c[:strokeStyle] = COL_ROCK
    c[:lineWidth] = 1.5
    i = 0
    while i < total
      if @fsm.field.is_alive(i)
        p = @fsm.field.position(i)
        c.call(:beginPath)
        c.call(:arc, p.x, p.y, @fsm.field.radius_of(i), 0, TWO_PI)
        c.call(:stroke)
      end
      i += 1
    end

    c[:fillStyle] = COL_BULLET
    @bullets.each do |b|
      c.call(:beginPath)
      c.call(:arc, b[0].x, b[0].y, BULLET_SIZE, 0, TWO_PI)
      c.call(:fill)
    end

    if state != "Attract" && state != "GameOver" && @fsm.ship.is_visible
      ss = @fsm.ship.get_current_state_name
      if ss == "Exploding"
        draw_explosion
      else
        visible = true
        visible = ((now / 100).to_i % 2 == 0) if ss == "Respawning"
        draw_ship if visible
      end
    end

    draw_hud(state)
  end

  def draw_ship
    a = @ship_angle
    at = @ship_pos
    nose  = at + Vec2.new(Math.cos(a), Math.sin(a)) * SHIP_SIZE
    left  = at + Vec2.new(Math.cos(a + 2.5), Math.sin(a + 2.5)) * SHIP_SIZE
    right = at + Vec2.new(Math.cos(a - 2.5), Math.sin(a - 2.5)) * SHIP_SIZE
    c = @ctx
    c[:strokeStyle] = COL_SHIP
    c[:lineWidth] = 1.5
    c.call(:beginPath)
    c.call(:moveTo, nose.x, nose.y)
    c.call(:lineTo, left.x, left.y)
    c.call(:lineTo, right.x, right.y)
    c.call(:closePath)
    c.call(:stroke)
    if thrust_held
      ss = @fsm.ship.get_current_state_name
      if ss == "Alive" || ss == "Respawning"
        tb = (left + right) * 0.5
        tt = at + Vec2.new(Math.cos(a), Math.sin(a)) * (-SHIP_SIZE * 1.4)
        c[:strokeStyle] = COL_FLAME
        c.call(:beginPath)
        c.call(:moveTo, tb.x, tb.y)
        c.call(:lineTo, tt.x, tt.y)
        c.call(:stroke)
      end
    end
  end

  def draw_explosion
    at = @ship_pos
    c = @ctx
    c[:strokeStyle] = COL_SHIP
    8.times do |i|
      t = i / 8.0 * TWO_PI
      c.call(:beginPath)
      c.call(:moveTo, at.x + Math.cos(t) * 4, at.y + Math.sin(t) * 4)
      c.call(:lineTo, at.x + Math.cos(t) * 14, at.y + Math.sin(t) * 14)
      c.call(:stroke)
    end
  end

  def draw_hud(state)
    c = @ctx
    c[:fillStyle] = COL_TEXT
    c[:textAlign] = "left"
    c[:font] = "16px monospace"
    hud = format("SCORE  %05d     LIVES  %d     WAVE  %d     DIFF  %d     WARP  %d",
                 @fsm.get_score, @fsm.get_lives, @fsm.get_wave,
                 @fsm.get_difficulty, @fsm.ship.get_hyperspaces_remaining)
    c.call(:fillText, hud, 12, 24)

    msg = nil
    case state
    when "Attract"   then msg = ["A S T E R O I D S", "", "Press any key to start", "(H hyperspace - P pause)"]
    when "WaveClear" then msg = ["WAVE CLEAR"]
    when "Paused"    then msg = ["PAUSED"]
    when "GameOver"  then msg = ["GAME OVER", "", "Press R to restart"]
    end
    return unless msg
    c[:textAlign] = "center"
    c[:font] = "26px monospace"
    y = (COURT_H * 0.4).to_i
    msg.each do |line|
      c.call(:fillText, line, COURT_W / 2, y) unless line.empty?
      y += 38
    end
  end
end

# \u2500\u2500 bootstrap: canvas, input, rAF loop \u2500\u2500
document = JS.global[:document]
canvas = document.call(:getElementById, "game")
$game = Game.new(canvas)

HELD = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]

$on_keydown = ->(e) {
  code = e[:code].to_s
  e.call(:preventDefault) if HELD.include?(code)
  $game.instance_variable_get(:@keys)[code] = true
  $game.on_keydown(code)
  JS::Undefined
}
$on_keyup = ->(e) {
  $game.instance_variable_get(:@keys).delete(e[:code].to_s)
  JS::Undefined
}
JS.global.call(:addEventListener, "keydown", $on_keydown)
JS.global.call(:addEventListener, "keyup", $on_keyup)

$game.fsm.start if JS.global[:location][:hash].to_s == "#autostart"  # dev/headless capture

$last = 0.0
$frame = ->(ts) {
  now = ts.to_f
  dt = $last == 0.0 ? 0.016 : (now - $last) / 1000.0
  dt = 0.05 if dt > 0.05
  $last = now
  $game.update(dt)
  $game.publish_state
  $game.draw(now)
  JS.global.call(:requestAnimationFrame, $frame)
  JS::Undefined
}
JS.global.call(:requestAnimationFrame, $frame)
`;(async()=>{let c=document.getElementById("status");try{let e=await fetch("./ruby.wasm"),n=await WebAssembly.compileStreaming(e),{vm:s}=await He(n);s.eval('require "js"'),s.eval(je),s.eval(Be),c&&(c.style.display="none")}catch(e){console.log("RUBY_BOOT_ERR "+e),c&&(c.textContent="error: "+e)}})();})();
