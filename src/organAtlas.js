// Reviewed organ shells from the same male atlas and world frame as the body.
// Exclude overlapping liver segments, stomach mucosa and pleural envelopes.
const entries=[
 ['Heart','心脏','heart'],['Left lung','左肺','lung'],['Right lung','右肺','lung'],
 ['Trachea','气管','airway'],['Left main bronchus','左主支气管','airway'],['Right main bronchus','右主支气管','airway'],
 ['Oesophagus','食管','oesophagus'],['Stomach','胃','stomach'],['Duodenum','十二指肠','intestine'],['Jejunum','空肠','intestine'],
 ['Ascending colon','升结肠','colon'],['Transverse colon','横结肠','colon'],['Descending colon','降结肠','colon'],['Sigmoid colon','乙状结肠','colon'],
 ['Vermiform appendix','阑尾','appendix'],['Liver','肝','liver'],['Gallbladder','胆囊','biliary'],['Bile duct','胆管','biliary'],
 ['Pancreas','胰','pancreas'],['Pancreatic duct','胰管','pancreas'],['Accessory pancreatic duct','副胰管','pancreas'],
 ['Spleen','脾','spleen'],['Kidney','肾','kidney'],['Renal pelvis','肾盂','kidney'],['Ureter','输尿管','ureter'],['Urinary bladder','膀胱','bladder'],['Urethra','尿道','bladder']
];
const chest=new Set(['heart','lung','airway','oesophagus']);
const colors={heart:'#ae665c',lung:'#a88b80',airway:'#c0ac8c',oesophagus:'#b69276',stomach:'#bb8e72',intestine:'#b59b79',colon:'#a38b6d',appendix:'#c49d7b',liver:'#985f50',biliary:'#99a474',pancreas:'#c7ac7e',spleen:'#956a79',kidney:'#a36f5a',ureter:'#ccb994',bladder:'#b89d74'};
export const ORGAN_GROUPS={
 Heart:['Left atrium','Right atrium','Left ventricle','Right ventricle'],
 'Left lung':['Superior lobe of left lung','Inferior lobe of left lung'],
 'Right lung':['Superior lobe of right lung','Middle lobe of right lung','Inferior lobe of right lung']
};
export const ORGAN_ATLAS=Object.fromEntries(entries.map(([en,zh,organ])=>[en.toLowerCase(),{en,zh,organ,region:chest.has(organ)?'chest':'abdomen',color:colors[organ]}]));
export const ORGAN_CONDITIONS={
 heart:['cardiac-ischaemia-warning'],lung:['pleuritic-chest-pain'],airway:['pleuritic-chest-pain'],
 oesophagus:['reflux-dyspepsia-pattern'],stomach:['reflux-dyspepsia-pattern','gastroenteritis-pattern'],
 intestine:['gastroenteritis-pattern'],colon:['gastroenteritis-pattern','diverticular-left-abdominal'],appendix:['appendicitis-pattern'],
 liver:['hepatobiliary-pattern','biliary-colic-pattern'],biliary:['biliary-colic-pattern'],pancreas:['pancreatitis-pattern'],
 spleen:['splenic-injury-warning'],kidney:['renal-colic-pattern','urinary-tract-infection-pattern'],ureter:['renal-colic-pattern','urinary-tract-infection-pattern'],bladder:['urinary-tract-infection-pattern']
};
