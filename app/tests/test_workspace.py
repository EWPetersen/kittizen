import json,math,unittest
import workspace
import test_profiles

class WorkspaceValidationTests(unittest.TestCase):
    def test_rejects_unbounded_or_nonfinite_values(self):
        base=dict(fleet=[],loadouts=[],offers=[])
        for bad in [None,{},dict(base,fleet=[{}]),dict(base,fleet=[{}]*101)]:
            with self.assertRaises(ValueError):workspace.validate(bad)
        row=dict(id='entry',itemId='00000000-0000-0000-0000-000000000001',quantity=1,currency='USD',ownership='pledged',paid=100,melt=None,note='safe')
        for field,value in [('quantity',True),('quantity',0),('quantity',101),('paid',float('nan')),('paid',-1),('currency','BTC'),('note','x'*161)]:
            with self.subTest(field=field,value=value):
                with self.assertRaises(ValueError):workspace.validate(dict(base,fleet=[dict(row,**{field:value})]))
        cleaned=workspace.validate(dict(base,fleet=[dict(row,email='private@example.invalid')]))
        self.assertNotIn('email',cleaned['fleet'][0])

class WorkspaceHTTPTests(unittest.TestCase):
    setUp=test_profiles.ProfileAuthTests.setUp
    tearDown=test_profiles.ProfileAuthTests.tearDown
    request=test_profiles.ProfileAuthTests.request
    new_client=test_profiles.ProfileAuthTests.new_client
    def test_workspace_is_private_and_persists(self):
        a=self.client;b=self.new_client()
        self.request('register',dict(handle='WorkspaceA',password='test-password-only'),a)
        self.request('register',dict(handle='WorkspaceB',password='test-password-only'),b)
        state=dict(fleet=[dict(id='entry',itemId='00000000-0000-0000-0000-000000000001',quantity=2,currency='USD',ownership='pledged',paid=45,melt=40,note='Private fleet note')],loadouts=[],offers=[])
        self.assertEqual(self.request('workspace',state,a)[0],200)
        self.assertEqual(self.request('workspace',client=a)[1],state)
        self.assertEqual(self.request('workspace?user=WorkspaceA',client=b)[1],dict(fleet=[],loadouts=[],offers=[]))
        self.assertEqual(self.request('workspace',client=self.new_client())[0],401)
        self.assertEqual(self.request('workspace',state,client=self.new_client())[0],401)
        self.assertNotIn('Private fleet note',json.dumps(self.request('profile?handle=WorkspaceA',client=b)[1]))
        self.assertEqual(self.request('workspace',dict(fleet=[{}],loadouts=[],offers=[]),a)[0],400)
        self.assertEqual(self.request('workspace',client=a)[1],state)
