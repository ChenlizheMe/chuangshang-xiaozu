const context=Object.freeze({
 zh:'已报告拇指、食指、中指和无名指、小指麻木。需要一起核实实际分布、起病和变化；这些选择不能确定受累神经、受压部位或是否为同一原因。',
 en:'Numbness has been reported in the thumb, index and middle fingers as well as the ring and little fingers. Assess the actual distribution, onset and course together; these selections do not establish the affected nerve, compression site or whether there is one cause.'
});
// This is saved-report context, not additional diagnostic evidence. Never
// combine separate profiles or consult an unassessed editor draft here.
export function mixedHandDistributionContext(result){
 if(result?.error||!Array.isArray(result?.profiles)||result.profiles.length!==1||!Array.isArray(result.items)||!Array.isArray(result.reportedSymptoms))return null;
 if(!['hand','upper-limb'].includes(result.profiles[0]?.region))return null;
 return ['拇食中指麻木','无名小指麻木'].every(id=>result.reportedSymptoms.includes(id))?context:null;
}
