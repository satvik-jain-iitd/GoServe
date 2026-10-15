// SUB 16, node "Prepare": one tiny question for Jev, to see that it answers (story #54). Nothing is written.
// The kill switch is checked by MAIN 01 before this SUB is called, and only MAIN 01 may call it.
const j = $input.first().json;
// A yes/no (noul) question on the decisions endpoint: Jev is a decisions model and the chat endpoint refuses it.
const question = { type: 'noul', instructions: 'Is the sky blue?', criteria: { true: 'The sky is blue.', false: 'The sky is not blue.' } };
return [{ json: { use_jev: j.jev_enabled === true, started_at: Date.now(),
  jev_body: { model: j.jev_model || 'typesafe/jev-1.13', state: {}, questions: { sky: question } } } }];
