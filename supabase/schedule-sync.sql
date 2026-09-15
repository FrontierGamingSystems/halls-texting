-- Existing production project: gdvzebqxecmanobdbhha.
-- First save the EXISTING BINGO_SYNC_KEY as bingo_monitor_sync_key in Vault.
-- Never paste the key into this file or commit it to GitHub.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- The stable job name updates the existing job instead of creating a duplicate.
select cron.schedule('bingo-sms-sync', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://frontier-bingo-text-monitor.andrew595321.chatgpt.site/api/monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bingo-sync-key', (select decrypted_secret from vault.decrypted_secrets where name = 'bingo_monitor_sync_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);

-- SQL completion means HTTP was queued, not that collection succeeded.
-- Check BOTH cron.job_run_details and net._http_response; HTTP must return 200.
-- Also verify public.bingo_state.last_sync advances. Zero newly added texts is valid.
select jobid, jobname, schedule, active from cron.job where jobname = 'bingo-sms-sync';
