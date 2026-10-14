// SUB 16, node "Prepare": one tiny question for Jev, to see that it answers (story #54). Nothing is written.
// The kill switch is checked by MAIN 01 before this SUB is called, and only MAIN 01 may call it.
const j = $input.first().json;
const options = ['yes', 'no'];
const prompt = 'State: {}\nQuestion: is the sky blue?\nAllowed choices: ' + options.join(', ') + '\nReply with JSON only: {"choice":"...","confidence":0.0,"reason":"..."}';
return [{ json: { use_jev: j.jev_enabled === true, options, started_at: Date.now(),
  jev_body: { model: j.jev_model || 'typesafe/jev-1.13', temperature: 0, max_tokens: 32, response_format: { type: 'json_object' }, usage: { include: true },
    messages: [{ role: 'user', content: prompt }] } } }];
