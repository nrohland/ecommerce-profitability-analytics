import importlib.util
from pathlib import Path
from datetime import date
import unittest

spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('security_audit.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)

class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.url='https://github.com/advisories/GHSA-vfj7-8cjw-p6xm'
        self.policy=[{'package':'braces','advisory':self.url,'expires':'2026-11-22','reason':'dev glob parser, no compatible patch'}]
        self.lock={'packages':{'node_modules/braces':{'dev':True}}}
        self.report={'vulnerabilities':{'braces':{'severity':'high','nodes':['node_modules/braces'],'via':[{'url':self.url,'severity':'high'}]},'eslint-config-next':{'severity':'high','via':['braces']}}}
    def run_policy(self):return audit.evaluate(self.report,self.lock,self.policy,date(2026,10,22))
    def test_exact_dev_leaf_and_ancestors_remain_visible(self):
        result=self.run_policy();self.assertEqual(result['status'],'pass');self.assertEqual(len(result['temporary_dev_exceptions']),1)
    def test_production_dependency_cannot_use_dev_exception(self):
        self.lock['packages']['node_modules/braces']['dev']=False;self.assertEqual(self.run_policy()['status'],'fail')
    def test_new_advisory_cannot_reuse_exception(self):
        self.report['vulnerabilities']['braces']['via'].append({'url':'https://github.com/advisories/NEW','severity':'critical'})
        self.assertEqual(self.run_policy()['status'],'fail')
    def test_expiry_blocks(self):
        result=audit.evaluate(self.report,self.lock,self.policy,date(2026,11,23));self.assertEqual(result['status'],'fail')
    def test_network_error_is_not_a_clean_scan(self):
        with self.assertRaises(ValueError):audit.evaluate({'error':{}},self.lock,self.policy,date(2026,10,22))
    def test_unknown_inherited_advisory_blocks(self):
        self.report['vulnerabilities']['eslint-config-next']['via']=['unknown']
        with self.assertRaises(ValueError):self.run_policy()
    def test_known_next_baseline_blocks_even_when_registry_is_empty(self):
        result=audit.evaluate({'vulnerabilities':{}},{'packages':{'node_modules/next':{'version':'16.3.8'}}},[],date(2026,10,22))
        self.assertEqual(result['status'],'fail')
    def test_missing_dev_metadata_cannot_bypass(self):
        self.lock={'packages':{}};self.assertEqual(self.run_policy()['status'],'fail')

if __name__=='__main__':unittest.main()
